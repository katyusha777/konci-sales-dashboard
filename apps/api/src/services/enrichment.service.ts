// Enrichment orchestrator — the full waterfall from the old repo's enrichment.task.ts
// (spec: .claude/ENRICHMENT.md), run synchronously inside the API request:
//
//   1. Google Places ∥ Firecrawl homepage → LLM page selection → subpage scrapes
//   2. LLM signal extraction (facts, services, hours, staff names)
//   3. Upsert website-discovered contacts · 3b. PDL/FullEnrich company + people search
//   4. Per-contact waterfall (PDL email search → Hunter → PDL enrich → FullEnrich)
//   5. Score (plan §4) + one LeadCost row per run
//
// Every provider call goes through record(): timed, dumped into enrichment_responses
// (request + raw response + cost), failures captured without aborting the run.

import type { Contact, EnrichmentProvider, Prisma } from '../generated/prisma/client'
import type { createPrisma } from '../lib/prisma'
import { testModeEmail } from '../lib/format'
import type { FullenrichContactResult } from './fullenrich.service'
import { getHostname, isBookingPlatform, isSharedDomain, shouldSkipScrape } from '../lib/website'
import { FirecrawlService } from './firecrawl.service'
import { FullenrichService } from './fullenrich.service'
import { GooglePlacesService } from './google-places.service'
import { HunterService } from './hunter.service'
import { LeadService } from './lead.service'
import { OpenrouterService } from './openrouter.service'
import { PdlService } from './pdl.service'

type PrismaClient = ReturnType<typeof createPrisma>

// Approximate retail pricing per call (USD) — see .claude/ENRICHMENT.md "Cost constants"
const COST = {
  googlePlaces: 0.017,
  firecrawlPerPage: 0.001,
  llmExtraction: 0.002,
  pdlCompany: 0.04,
  pdlPersonSearch: 0.04,
  pdlPersonEnrich: 0.04,
  hunterEmailFind: 0.017,
  fullenrichEnrich: 0.07,
  fullenrichReverse: 0.03,
} as const

const SAVE_CONFIDENCE = 4 // normalized 1–10 floor for saving a waterfall result
const MAX_ATTEMPTS = 3
const COMPLETED_FRESH_DAYS = 30
const RESPONSE_STRING_CAP = 30_000 // truncate huge markdown blobs in the audit dump
// A hung provider connection must not stall the whole run — observed 3–4 min hangs
// before the Workers runtime gave up. Generous: the slowest legitimate ops are
// extract_signals (~30s) and FullEnrich submit+poll (~35s).
const CALL_TIMEOUT_MS = 90_000

interface RunCall {
  provider: EnrichmentProvider
  operation: string
  costUsd: number
}

interface RunContext {
  prisma: PrismaClient
  env: Env
  leadId: string
  calls: Array<RunCall>
}

// What the per-contact waterfall produces, whatever the provider
interface WaterfallHit {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  confidence: number
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Deep-copy a value for the Json column, truncating giant strings (scraped markdown)
function jsonDump(value: unknown): Prisma.InputJsonValue {
  const seen = JSON.stringify(value, (_key, v) =>
    typeof v === 'string' && v.length > RESPONSE_STRING_CAP ? `${v.slice(0, RESPONSE_STRING_CAP)}… [truncated]` : v)
  return seen === undefined ? null as unknown as Prisma.InputJsonValue : JSON.parse(seen)
}

function normalizeEmail(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase()
  return value || undefined
}

function normalizeLinkedin(url?: string | null): string | undefined {
  if (!url)
    return undefined
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '').toLowerCase()}`
  }
  catch {
    return url.trim().toLowerCase() || undefined
  }
}

function normalizeName(name?: string | null): string | undefined {
  const value = name?.trim().toLowerCase()
  return value || undefined
}

// "Monday: 9:00 AM – 5:00 PM" weekday_text lines → { Monday: "9:00 AM – 5:00 PM" }
function hoursFromWeekdayText(lines: Array<string>): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const line of lines) {
    const idx = line.indexOf(': ')
    if (idx > 0)
      out[line.slice(0, idx)] = line.slice(idx + 2)
  }
  return Object.keys(out).length ? out : null
}

export interface EnrichmentGuardResult {
  skipped: true
  reason: string
}

export abstract class EnrichmentService {
  /**
   * Run the full enrichment waterfall for one lead. Returns null when it ran
   * (state is on the lead), or a guard result when skipped.
   */
  static async enrich(prisma: PrismaClient, env: Env, leadId: string, force = false): Promise<EnrichmentGuardResult | null> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { contacts: true } })
    if (!lead)
      throw new Error('Lead not found')

    // Retry guard (plan §4): never burn credits on a hopeless or fresh lead unless forced
    if (!force) {
      const completedRecently = lead.enrichmentStatus === 'COMPLETED' && lead.lastEnrichedAt
        && lead.lastEnrichedAt.getTime() > Date.now() - COMPLETED_FRESH_DAYS * 86_400_000
      if (completedRecently)
        return { skipped: true, reason: `Enriched ${lead.lastEnrichedAt!.toISOString().slice(0, 10)} — still fresh (<${COMPLETED_FRESH_DAYS} days). Use Re-enrich to force.` }
      if (lead.enrichmentAttempts >= MAX_ATTEMPTS)
        return { skipped: true, reason: `Already attempted ${lead.enrichmentAttempts} times. Use Re-enrich to force.` }
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { enrichmentStatus: 'IN_PROGRESS', enrichmentAttempts: { increment: 1 }, enrichmentError: null },
    })
    // force re-attempts contacts that were already charged for ("never pay twice" reset)
    if (force && lead.contacts.length > 0) {
      await prisma.contact.updateMany({ where: { leadId: lead.id }, data: { enrichedAt: null } })
      for (const c of lead.contacts) c.enrichedAt = null
    }

    const ctx: RunContext = { prisma, env, leadId: lead.id, calls: [] }

    try {
      await this.run(ctx, lead)
      await this.finalize(ctx, 'COMPLETED', null)
      // S4b: pick the decision-maker email now that contacts are final. force
      // re-picks (owner explicitly re-enriched); failure never fails the enrichment.
      await this.pickOutreachEmail(prisma, env, lead.id, force).catch(err =>
        console.error(`[outreach-pick] ${lead.id}:`, (err as Error).message))
    }
    catch (err) {
      await this.finalize(ctx, 'FAILED', (err as Error).message)
    }
    return null
  }

  // ── The waterfall ─────────────────────────────────────────────────────────────

  private static async run(ctx: RunContext, lead: LeadWithContacts) {
    const { prisma, env } = ctx

    // Step 1 — Google Places ∥ homepage scrape
    const query = [lead.name, lead.city, lead.state].filter(Boolean).join(' ')
    const [googleSettled, homepageSettled] = await Promise.allSettled([
      this.record(ctx, 'GOOGLE_PLACES', 'lookup', { query }, r => r ? COST.googlePlaces : 0,
        () => GooglePlacesService.lookup(env, query)),
      lead.website && !shouldSkipScrape(lead.website)
        ? this.record(ctx, 'FIRECRAWL', 'scrape', { url: lead.website }, () => COST.firecrawlPerPage,
            () => FirecrawlService.scrape(env, lead.website!))
        : Promise.resolve(null),
    ])
    const google = googleSettled.status === 'fulfilled' ? googleSettled.value : null
    let homepage = homepageSettled.status === 'fulfilled' ? homepageSettled.value : null

    // Gap-fill business identity from Google (canonical website matters for manual leads)
    if (google) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          googleRating: google.rating ?? lead.googleRating,
          googleReviewCount: google.reviewCount ?? lead.googleReviewCount,
          googlePlaceId: lead.googlePlaceId ?? google.placeId ?? undefined,
          phone: lead.phone ?? google.phone ?? undefined,
          website: lead.website ?? google.website ?? undefined,
          // google.address is the full formatted address — keep only the street segment
          street: lead.street ?? google.address?.split(',')[0] ?? undefined,
          businessHours: lead.businessHours ?? (google.businessHours.length ? hoursFromWeekdayText(google.businessHours) ?? undefined : undefined),
          categories: lead.categories.length ? lead.categories : google.types,
        },
      })
      if (!lead.website && google.website) {
        lead.website = google.website
        // The lead had no website until Google found it — scrape it now
        if (!shouldSkipScrape(lead.website)) {
          homepage = await this.record(ctx, 'FIRECRAWL', 'scrape', { url: lead.website }, () => COST.firecrawlPerPage,
            () => FirecrawlService.scrape(env, lead.website!)).catch(() => null)
        }
      }
    }

    // Step 1b — LLM picks subpages worth scraping; booking platforms get known paths injected
    let markdown = homepage?.markdown ?? null
    if (homepage) {
      const injected: Array<string> = []
      if (isBookingPlatform(lead.website)) {
        const rawBase = (lead.website!.endsWith('/') ? lead.website!.slice(0, -1) : lead.website!)
          .replace(/\/(book-now|schedule|appointments|reserve|checkout|cart)(\/.*)?$|\/(book|booking)$/i, '')
        // www.vagaro.com is a SPA whose sub-pages come back empty — mysite.vagaro.com has real HTML
        const alternateBase = rawBase.replace(/^(https?:\/\/)www\.vagaro\.com\//, '$1mysite.vagaro.com/')
        for (const base of [...new Set([rawBase, alternateBase])])
          injected.push(`${base}/staff`, `${base}/services`, `${base}/about`, `${base}/book-now`, `${base}/book`)
      }
      // Injected links go first so they survive the 150-link cap inside selectPagesToScrape
      const candidates = [...injected, ...homepage.links]
      if (candidates.length > 0) {
        const subpageUrls = await this.record(ctx, 'OPENROUTER', 'select_pages', { baseUrl: lead.website, candidateCount: candidates.length }, () => 0,
          () => OpenrouterService.selectPagesToScrape(env, { baseUrl: lead.website!, links: candidates, maxPages: 5 })).catch(() => [] as Array<string>)
        if (subpageUrls.length > 0) {
          const subpages = await this.record(ctx, 'FIRECRAWL', 'batch_scrape', { urls: subpageUrls }, r => r.length * COST.firecrawlPerPage,
            () => FirecrawlService.batchScrape(env, subpageUrls)).catch(() => [] as Array<{ url: string, markdown: string }>)
          if (subpages.length > 0)
            markdown = [homepage.markdown, ...subpages.map(p => `\n\n---\n<!-- Page: ${p.url} -->\n${p.markdown}`)].join('')
        }
      }
    }

    // Steps 2 + 3 — extract signals from the scraped site, apply, upsert staff contacts
    const signals = markdown
      ? await this.extractAndApply(ctx, lead, markdown)
      : null

    // Step 3b — company enrichment + people search (PDL primary, FullEnrich fallback)
    let pdlCompanyDomain: string | undefined
    let companyLinkedinUrl: string | undefined
    if (env.PDL_API_KEY) {
      const companyInput = {
        name: signals?.canonicalName ?? lead.name,
        website: signals?.canonicalDomain ? `https://${signals.canonicalDomain}` : lead.website ?? undefined,
        city: lead.city ?? undefined,
        state: lead.state ?? undefined,
      }
      let company = await this.record(ctx, 'PDL', 'company_enrich', companyInput, r => r ? COST.pdlCompany : 0,
        () => PdlService.enrichCompany(env, companyInput)).catch(() => null)

      if (!company && env.FULLENRICH_API_KEY) {
        const feCompany = await this.record(ctx, 'FULLENRICH', 'company_search', { name: lead.name }, () => 0,
          () => FullenrichService.searchCompany(env, {
            name: lead.name,
            domain: lead.website && !isSharedDomain(lead.website) ? getHostname(lead.website) ?? undefined : undefined,
            city: lead.city ?? undefined,
            state: lead.state ?? undefined,
          })).catch(() => null)
        if (feCompany)
          company = { name: feCompany.name, industry: feCompany.industry, employeeCount: feCompany.employeeCount, website: feCompany.domain, linkedinUrl: feCompany.linkedinUrl, likelihood: null, raw: feCompany.raw }
      }

      if (company) {
        companyLinkedinUrl = company.linkedinUrl ?? undefined
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            industry: lead.industry ?? company.industry ?? undefined,
            employeeCount: lead.employeeCount ?? company.employeeCount ?? undefined,
          },
        })
        if (lead.industry === null && company.industry)
          lead.industry = company.industry

        // A real (non-shared) domain the lead didn't have → website gap-fill + one extra scrape pass
        if (company.website && !isSharedDomain(company.website)) {
          pdlCompanyDomain = getHostname(company.website) ?? undefined
          if (!lead.website) {
            const realUrl = company.website.startsWith('http') ? company.website : `https://${company.website}`
            await prisma.lead.update({ where: { id: lead.id }, data: { website: realUrl } })
            lead.website = realUrl
            await this.scrapeRealSite(ctx, lead, realUrl)
          }
        }
      }

      // People search — skip when contacts were already searched (unless force reset them)
      const hasSearchedContacts = lead.contacts.some(c => c.enrichedAt !== null)
      if (!hasSearchedContacts) {
        const searchInput = {
          company: lead.name,
          city: lead.city ?? undefined,
          state: lead.state ?? undefined,
          companyLinkedinUrl,
          companyDomain: pdlCompanyDomain,
          limit: 10,
        }
        const search = await this.record(ctx, 'PDL', 'search_people', searchInput, () => COST.pdlPersonSearch,
          () => PdlService.searchPeople(env, searchInput)).catch(() => null)

        for (const person of search?.results ?? []) {
          await this.upsertContact(ctx, lead, {
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.workEmail,
            phone: person.phones[0] ?? null,
            jobTitle: person.jobTitle,
            linkedinUrl: person.linkedinUrl,
            source: 'PDL',
            confidence: person.confidence,
            // Only mark charged-for when we actually got an email — name-only discoveries
            // stay unattempted so step 4 still chases their email.
            enrichedAt: person.workEmail ? new Date() : null,
          })
        }

        if ((search?.results ?? []).length === 0 && env.FULLENRICH_API_KEY) {
          const fePeople = await this.record(ctx, 'FULLENRICH', 'search_people', { company: lead.name }, () => 0,
            () => FullenrichService.searchPeople(env, { company: lead.name, domain: pdlCompanyDomain, city: lead.city ?? undefined, state: lead.state ?? undefined, limit: 10 })).catch(() => [] as Array<FullenrichContactResult>)
          for (const person of fePeople) {
            await this.upsertContact(ctx, lead, {
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.workEmail,
              phone: person.phones[0] ?? null,
              jobTitle: person.jobTitle,
              linkedinUrl: person.linkedinUrl,
              source: 'FULLENRICH',
              confidence: person.confidence,
              enrichedAt: person.workEmail ? new Date() : null,
            })
          }
        }
      }
    }

    // Step 4 — per-contact waterfall, parallel (FullEnrich polls ~30s per contact)
    const ownDomain = lead.website && !isSharedDomain(lead.website) ? getHostname(lead.website) ?? undefined : undefined
    const companyDomain = signals?.canonicalDomain ?? ownDomain ?? pdlCompanyDomain
    const companyName = signals?.canonicalName ?? lead.name

    const allContacts = await prisma.contact.findMany({ where: { leadId: lead.id } })
    const unattempted = allContacts.filter(c => c.enrichedAt === null)
    await Promise.allSettled(unattempted.map(contact =>
      this.enrichContact(ctx, contact, { companyName, companyDomain, city: lead.city ?? undefined, state: lead.state ?? undefined })))
  }

  /** LLM extraction on scraped markdown → apply business fields + upsert staff contacts. */
  private static async extractAndApply(ctx: RunContext, lead: LeadWithContacts, markdown: string) {
    const { prisma, env } = ctx
    const signals = await this.record(ctx, 'OPENROUTER', 'extract_signals', { businessName: lead.name, markdownChars: markdown.length }, () => COST.llmExtraction,
      () => OpenrouterService.extractSignals(env, { markdown, businessName: lead.name })).catch(() => null)
    if (!signals || !signals.contentIsRelevant)
      return signals

    const ownerFact = signals.facts.find(f => f.key === 'owner_name')?.value
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        industry: lead.industry ?? signals.industry ?? undefined,
        services: signals.services.length ? signals.services : undefined,
        businessHours: lead.businessHours ?? signals.businessHours ?? undefined,
        description: signals.summary ?? lead.description ?? undefined,
        ownerName: lead.ownerName ?? ownerFact ?? undefined,
      },
    })
    if (lead.industry === null && signals.industry)
      lead.industry = signals.industry

    for (const dc of signals.discoveredContacts) {
      if (!dc.firstName && !dc.lastName)
        continue
      await this.upsertContact(ctx, lead, {
        firstName: dc.firstName,
        lastName: dc.lastName,
        email: dc.email,
        phone: null,
        jobTitle: dc.jobTitle,
        linkedinUrl: null,
        source: 'WEBSITE',
        confidence: null,
        enrichedAt: null,
      })
    }
    return signals
  }

  /** One extra scrape+extract pass against a provider-discovered real website. */
  private static async scrapeRealSite(ctx: RunContext, lead: LeadWithContacts, url: string) {
    const home = await this.record(ctx, 'FIRECRAWL', 'scrape', { url, discoveredBy: 'company_enrich' }, () => COST.firecrawlPerPage,
      () => FirecrawlService.scrape(ctx.env, url)).catch(() => null)
    if (!home)
      return
    let markdown = home.markdown
    if (home.links.length > 0) {
      const subUrls = await this.record(ctx, 'OPENROUTER', 'select_pages', { baseUrl: url, candidateCount: home.links.length }, () => 0,
        () => OpenrouterService.selectPagesToScrape(ctx.env, { baseUrl: url, links: home.links, maxPages: 3 })).catch(() => [] as Array<string>)
      if (subUrls.length > 0) {
        const subpages = await this.record(ctx, 'FIRECRAWL', 'batch_scrape', { urls: subUrls }, r => r.length * COST.firecrawlPerPage,
          () => FirecrawlService.batchScrape(ctx.env, subUrls)).catch(() => [] as Array<{ url: string, markdown: string }>)
        if (subpages.length > 0)
          markdown = [home.markdown, ...subpages.map(p => `\n\n---\n<!-- Page: ${p.url} -->\n${p.markdown}`)].join('')
      }
    }
    await this.extractAndApply(ctx, lead, markdown)
  }

  // ── Step 4: the per-contact waterfall (cheapest first, stop at first hit) ────

  private static async enrichContact(ctx: RunContext, contact: Contact, company: { companyName: string, companyDomain?: string, city?: string, state?: string }) {
    const { prisma, env } = ctx
    let hit: WaterfallHit | null = null

    // A) email but no name → PDL reverse email search
    if (!hit && env.PDL_API_KEY && contact.email && !contact.firstName && !contact.lastName) {
      const person = await this.record(ctx, 'PDL', 'search_by_email', { email: contact.email }, () => 0,
        () => PdlService.searchByEmail(env, contact.email!)).catch(() => null)
      if (person)
        hit = { firstName: person.firstName, lastName: person.lastName, email: person.workEmail ?? contact.email, phone: person.phones[0] ?? null, jobTitle: person.jobTitle, linkedinUrl: person.linkedinUrl, confidence: person.confidence }
    }

    // B) name + real domain → Hunter email finder (charged only on match)
    if (!hit && env.HUNTER_API_KEY && contact.firstName && contact.lastName && company.companyDomain) {
      const input = { firstName: contact.firstName, lastName: contact.lastName, domain: company.companyDomain }
      const found = await this.record(ctx, 'HUNTER', 'find_email', input, r => r ? COST.hunterEmailFind : 0,
        () => HunterService.findEmail(env, input)).catch(() => null)
      if (found)
        hit = { firstName: contact.firstName, lastName: contact.lastName, email: found.email, phone: null, jobTitle: null, linkedinUrl: null, confidence: found.confidence }
    }

    // C) PDL person enrich — straight via LinkedIn URL, else LLM picks the query fields.
    // PDL's minimum data combination is email/LinkedIn/full-name+company — a lone first
    // name (website stylists) can never match, so don't waste the call.
    const canPdlEnrich = !!(contact.linkedinUrl || contact.email || (contact.firstName && contact.lastName))
    if (!hit && env.PDL_API_KEY && canPdlEnrich) {
      let input: Parameters<typeof PdlService.enrichPerson>[1] | null = null
      if (contact.linkedinUrl) {
        input = { linkedinUrl: contact.linkedinUrl, firstName: contact.firstName ?? undefined, lastName: contact.lastName ?? undefined }
      }
      else {
        const prepared = await this.record(ctx, 'OPENROUTER', 'prepare_pdl_query', { contact: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() }, () => 0,
          () => OpenrouterService.preparePdlQuery(env, {
            contact: { firstName: contact.firstName ?? undefined, lastName: contact.lastName ?? undefined, jobTitle: contact.jobTitle ?? undefined, email: contact.email ?? undefined },
            company: { name: company.companyName, domain: company.companyDomain, city: company.city, state: company.state },
          })).catch(() => null)
        if (prepared) {
          input = {
            firstName: prepared.firstName ?? undefined,
            lastName: prepared.lastName ?? undefined,
            // Keep the company context even when the LLM nulls it — PDL rejects
            // name-only queries without a company/location anchor.
            company: prepared.company ?? company.companyName,
            domain: prepared.domain ?? company.companyDomain,
            email: prepared.email ?? undefined,
          }
        }
      }
      if (input) {
        const person = await this.record(ctx, 'PDL', 'person_enrich', input, r => r ? COST.pdlPersonEnrich : 0,
          () => PdlService.enrichPerson(env, input!)).catch(() => null)
        if (person)
          hit = { firstName: person.firstName, lastName: person.lastName, email: person.workEmail, phone: person.phones[0] ?? null, jobTitle: person.jobTitle, linkedinUrl: person.linkedinUrl, confidence: person.confidence }
      }
    }

    // D/E) FullEnrich — async submit + inline poll; most expensive, best coverage
    if (!hit && env.FULLENRICH_API_KEY) {
      if (contact.email && !contact.firstName && !contact.lastName) {
        const result = await this.record(ctx, 'FULLENRICH', 'reverse_email', { email: contact.email }, () => COST.fullenrichReverse,
          async () => {
            const { enrichmentId } = await FullenrichService.submitReverseEmail(env, contact.email!)
            return this.poll(() => FullenrichService.getReverseEmailResult(env, enrichmentId))
          }).catch(() => null)
        if (result)
          hit = this.fromFullenrich(result, contact)
      }
      else if (contact.firstName && contact.lastName) {
        const input = { firstName: contact.firstName, lastName: contact.lastName, company: company.companyName, domain: company.companyDomain, linkedinUrl: contact.linkedinUrl ?? undefined }
        const result = await this.record(ctx, 'FULLENRICH', 'enrich', input, r => r ? COST.fullenrichEnrich : 0,
          async () => {
            const { enrichmentId } = await FullenrichService.submitEnrich(env, input)
            return this.poll(() => FullenrichService.getEnrichResult(env, enrichmentId))
          }).catch(() => null)
        if (result)
          hit = this.fromFullenrich(result, contact)
      }
    }

    // Save on confidence ≥ 4; stamp enrichedAt either way so a re-run never re-spends.
    // contact.source stays the discovery origin — the provider that found the email
    // is visible in the enrichment_responses ledger.
    if (hit && hit.confidence >= SAVE_CONFIDENCE) {
      try {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            firstName: hit.firstName ?? contact.firstName,
            lastName: hit.lastName ?? contact.lastName,
            email: normalizeEmail(hit.email) ?? contact.email,
            phone: hit.phone ?? contact.phone,
            jobTitle: hit.jobTitle ?? contact.jobTitle,
            linkedinUrl: hit.linkedinUrl ?? contact.linkedinUrl,
            confidence: hit.confidence,
            enrichedAt: new Date(),
          },
        })
      }
      catch {
        // Unique (leadId, email) collision — another contact already owns that email.
        // Keep this row as-is, just mark attempted.
        await prisma.contact.update({ where: { id: contact.id }, data: { enrichedAt: new Date() } })
      }
    }
    else {
      await prisma.contact.update({ where: { id: contact.id }, data: { enrichedAt: new Date() } })
    }
  }

  private static fromFullenrich(r: FullenrichContactResult, contact: Contact): WaterfallHit {
    return {
      firstName: r.firstName ?? contact.firstName,
      lastName: r.lastName ?? contact.lastName,
      email: r.workEmail ?? r.personalEmail,
      phone: r.phones[0] ?? null,
      jobTitle: r.jobTitle,
      linkedinUrl: r.linkedinUrl,
      confidence: r.confidence,
    }
  }

  /** Inline poll for FullEnrich async results: ~3s × 10 tries. */
  private static async poll(get: () => Promise<{ status: string, result: FullenrichContactResult | null }>): Promise<FullenrichContactResult | null> {
    for (let i = 0; i < 10; i++) {
      await sleep(3000)
      const res = await get()
      if (res.status === 'FINISHED')
        return res.result
      if (res.status === 'CANCELED')
        return null
    }
    return null
  }

  // ── Contact upsert (match by email → LinkedIn → full name) ───────────────────

  private static async upsertContact(ctx: RunContext, lead: LeadWithContacts, incoming: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    jobTitle: string | null
    linkedinUrl: string | null
    source: 'WEBSITE' | 'PDL' | 'FULLENRICH'
    confidence: number | null
    enrichedAt: Date | null
  }) {
    const email = normalizeEmail(incoming.email)
    const linkedin = normalizeLinkedin(incoming.linkedinUrl)
    const firstName = normalizeName(incoming.firstName)
    const lastName = normalizeName(incoming.lastName)

    const existing = lead.contacts.find((c) => {
      const sameEmail = email && normalizeEmail(c.email) === email
      const sameLinkedin = linkedin && normalizeLinkedin(c.linkedinUrl) === linkedin
      const sameName = firstName && lastName
        && normalizeName(c.firstName) === firstName && normalizeName(c.lastName) === lastName
      return !!(sameEmail || sameLinkedin || sameName)
    })

    if (existing) {
      const updated = await ctx.prisma.contact.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName ?? incoming.firstName ?? undefined,
          lastName: existing.lastName ?? incoming.lastName ?? undefined,
          email: existing.email ?? email ?? undefined,
          phone: existing.phone ?? incoming.phone ?? undefined,
          jobTitle: existing.jobTitle ?? incoming.jobTitle ?? undefined,
          linkedinUrl: existing.linkedinUrl ?? incoming.linkedinUrl ?? undefined,
          confidence: incoming.confidence ?? existing.confidence ?? undefined,
          enrichedAt: incoming.enrichedAt ?? existing.enrichedAt ?? undefined,
        },
      })
      const i = lead.contacts.findIndex(c => c.id === existing.id)
      if (i >= 0)
        lead.contacts[i] = updated
      return updated
    }

    const nextPriority = lead.contacts.length > 0 ? Math.max(...lead.contacts.map(c => c.priority)) + 1 : 1
    const created = await ctx.prisma.contact.create({
      data: {
        leadId: lead.id,
        firstName: incoming.firstName,
        lastName: incoming.lastName,
        email,
        phone: incoming.phone,
        jobTitle: incoming.jobTitle,
        linkedinUrl: incoming.linkedinUrl,
        priority: nextPriority,
        source: incoming.source,
        confidence: incoming.confidence,
        enrichedAt: incoming.enrichedAt,
      },
    })
    lead.contacts.push(created)
    return created
  }

  // ── Audit ledger + cost accounting ────────────────────────────────────────────

  /**
   * Wrap a provider call: time it, write one enrichment_responses row (success or
   * failure), track its cost for the run's LeadCost aggregate. Rethrows on error —
   * callers decide whether a failure is fatal (usually .catch(() => null)).
   */
  private static async record<T>(
    ctx: RunContext,
    provider: EnrichmentProvider,
    operation: string,
    request: unknown,
    cost: (result: T) => number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now()
    try {
      const result = await Promise.race([
        fn(),
        sleep(CALL_TIMEOUT_MS).then(() => {
          throw new Error(`${provider} ${operation} timed out after ${CALL_TIMEOUT_MS / 1000}s`)
        }),
      ])
      const costUsd = cost(result)
      ctx.calls.push({ provider, operation, costUsd })
      await ctx.prisma.enrichmentResponse.create({
        data: {
          leadId: ctx.leadId,
          provider,
          operation,
          request: jsonDump(request),
          response: jsonDump(result),
          success: true,
          costUsd,
          durationMs: Date.now() - started,
        },
      })
      return result
    }
    catch (err) {
      ctx.calls.push({ provider, operation, costUsd: 0 })
      await ctx.prisma.enrichmentResponse.create({
        data: {
          leadId: ctx.leadId,
          provider,
          operation,
          request: jsonDump(request),
          success: false,
          error: (err as Error).message,
          costUsd: 0,
          durationMs: Date.now() - started,
        },
      }).catch(() => {}) // the audit row must never mask the real error
      throw err
    }
  }

  /**
   * S4b — AI decision-maker pick. Chooses among all known emails (contacts + the
   * lead's own inbox) and stamps lead.outreachEmail/-ContactId/-Reason. An existing
   * pick is kept unless force. Logged to enrichment_responses like any provider call.
   */
  static async pickOutreachEmail(prisma: PrismaClient, env: Env, leadId: string, force = false): Promise<{ picked: boolean, email?: string | null, reason: string | null }> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contacts: { orderBy: { priority: 'asc' } } },
    })
    if (!lead)
      throw new Error('Lead not found')
    if (lead.outreachEmail && !force)
      return { picked: false, reason: 'Outreach email already set — use force to re-pick' }

    const candidates = [
      ...lead.contacts.filter(c => c.email).map(c => ({
        email: c.email!,
        contactId: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
        jobTitle: c.jobTitle,
        emailStatus: c.emailStatus as string,
        source: c.source as string,
      })),
      ...(lead.email ? [{ email: lead.email, contactId: null, name: null, jobTitle: null, emailStatus: null, source: 'lead inbox' }] : []),
    ]
    if (candidates.length === 0)
      return { picked: false, reason: 'No candidate emails on the lead' }

    const started = Date.now()
    try {
      const pick = await OpenrouterService.pickOutreachEmail(env, { businessName: lead.name, industry: lead.industry, candidates })
      await prisma.enrichmentResponse.create({
        data: {
          leadId,
          provider: 'OPENROUTER',
          operation: 'pick_outreach_email',
          request: jsonDump({ candidates }),
          response: jsonDump(pick),
          success: true,
          costUsd: '0.0020',
          durationMs: Date.now() - started,
        },
      }).catch(() => {})
      if (!pick.email)
        return { picked: false, reason: pick.reason ?? 'AI found no usable candidate' }
      // EMAIL_TEST_MODE paranoia (plan §6): store the @katyusha.app catch-all as the
      // outreach address, not the real pick. The AI's choice/reason is still recorded.
      const outreachEmail = env.EMAIL_TEST_MODE === 'true' ? testModeEmail(lead.name) : pick.email
      await prisma.lead.update({
        where: { id: leadId },
        data: { outreachEmail, outreachContactId: pick.contactId, outreachEmailReason: pick.reason },
      })
      return { picked: true, email: outreachEmail, reason: pick.reason }
    }
    catch (err) {
      await prisma.enrichmentResponse.create({
        data: {
          leadId,
          provider: 'OPENROUTER',
          operation: 'pick_outreach_email',
          request: jsonDump({ candidates }),
          success: false,
          error: (err as Error).message,
          costUsd: 0,
          durationMs: Date.now() - started,
        },
      }).catch(() => {})
      throw err
    }
  }

  /** Score + status + one aggregated LeadCost row + denormalized lead.totalCostUsd. */
  private static async finalize(ctx: RunContext, status: 'COMPLETED' | 'FAILED', error: string | null) {
    const { prisma, leadId } = ctx
    const [lead, contacts] = await Promise.all([
      prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.contact.findMany({ where: { leadId } }),
    ])

    const totalCost = ctx.calls.reduce((sum, c) => sum + c.costUsd, 0)
    if (ctx.calls.length > 0) {
      const byProvider: Record<string, number> = {}
      for (const c of ctx.calls)
        byProvider[c.provider] = (byProvider[c.provider] ?? 0) + c.costUsd
      await prisma.leadCost.create({
        data: {
          leadId,
          type: 'ENRICHMENT',
          amountUsd: totalCost.toFixed(4),
          description: `Enrichment run — ${ctx.calls.length} provider calls`,
          meta: { calls: ctx.calls.length, byProvider: jsonDump(byProvider) },
        },
      })
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentScore: LeadService.computeScore(lead, contacts),
        enrichmentStatus: status,
        enrichmentError: error,
        lastEnrichedAt: new Date(),
        totalCostUsd: { increment: totalCost.toFixed(4) },
        status: lead.status === 'NEW' && status === 'COMPLETED' ? 'ENRICHED' : lead.status,
      },
    })
  }

  /**
   * Cron tick — auto-enrich freshly mined leads: every lead lands as PENDING (schema
   * default), the tick works through them oldest-first. A run that fails goes to
   * FAILED and is NOT retried automatically (never burn credits in a loop) — the
   * owner retries from the lead page. Small batch: one run is many provider calls.
   */
  static async runEnrichTick(prisma: PrismaClient, env: Env, limit = 3): Promise<{ enriched: number }> {
    const leads = await prisma.lead.findMany({
      where: { enrichmentStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: limit,
    })
    let enriched = 0
    for (const l of leads) {
      // Claim atomically — cron, manual "Run scheduler", and the dev self-tick can
      // overlap, and a double enrichment double-spends credits.
      const claimed = await prisma.lead.updateMany({ where: { id: l.id, enrichmentStatus: 'PENDING' }, data: { enrichmentStatus: 'IN_PROGRESS' } })
      if (claimed.count === 0)
        continue
      try {
        await this.enrich(prisma, env, l.id)
        enriched++
      }
      catch (err) {
        console.error(`[enrich-tick] ${l.id}:`, (err as Error).message)
        // enrich() only throws before any credits are spent — release the claim.
        await prisma.lead.updateMany({ where: { id: l.id, enrichmentStatus: 'IN_PROGRESS' }, data: { enrichmentStatus: 'FAILED', enrichmentError: (err as Error).message } })
      }
    }
    return { enriched }
  }
}

// Helper types for the lead+contacts shape threaded through the run
function loadLead(prisma: PrismaClient, id: string) {
  return prisma.lead.findUnique({ where: { id }, include: { contacts: true } })
}
type LeadWithContacts = NonNullable<Awaited<ReturnType<typeof loadLead>>>
