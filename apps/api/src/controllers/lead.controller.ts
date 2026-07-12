import type { Contact, EnrichmentResponse, EnrichmentStatus, Lead, LeadCost, LeadNote, LeadStatus } from '../generated/prisma/client'
import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { LeadCreateData } from '../services/lead.service'
import { LeadService } from '../services/lead.service'
import { EnrichmentService } from '../services/enrichment.service'
import { OpenrouterService } from '../services/openrouter.service'
import type { ScrapioResult } from '../services/scrapio.service'
import { ScrapioService } from '../services/scrapio.service'

// ── Wire serializers — keep the JSON shape exactly on the frontend ILead types
// (Prisma Decimal → number, DateTime → ISO string) ──────────────────────────────

const iso = (d: Date | null) => d ? d.toISOString() : null

function serializeLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    domain: lead.domain,
    website: lead.website,
    email: lead.email,
    phone: lead.phone,
    street: lead.street,
    city: lead.city,
    state: lead.state,
    postalCode: lead.postalCode,
    country: lead.country,
    industry: lead.industry,
    categories: lead.categories,
    googleRating: lead.googleRating,
    googleReviewCount: lead.googleReviewCount,
    employeeCount: lead.employeeCount,
    services: lead.services,
    businessHours: lead.businessHours as Record<string, string> | null,
    description: lead.description,
    ownerName: lead.ownerName,
    source: lead.source,
    status: lead.status,
    enrichmentStatus: lead.enrichmentStatus,
    enrichmentScore: lead.enrichmentScore,
    enrichmentAttempts: lead.enrichmentAttempts,
    lastEnrichedAt: iso(lead.lastEnrichedAt),
    enrichmentError: lead.enrichmentError,
    assignedTo: lead.assignedTo,
    lastContactedAt: iso(lead.lastContactedAt),
    lastEngagedAt: iso(lead.lastEngagedAt),
    konciCustomerId: lead.konciCustomerId,
    demoPhone: lead.demoPhone,
    demoPin: lead.demoPin,
    totalCostUsd: Number(lead.totalCostUsd),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

function serializeContact(c: Contact) {
  return {
    id: c.id,
    leadId: c.leadId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    jobTitle: c.jobTitle,
    linkedinUrl: c.linkedinUrl,
    priority: c.priority,
    emailStatus: c.emailStatus,
    source: c.source,
    confidence: c.confidence,
  }
}

function serializeNote(n: LeadNote) {
  return { id: n.id, leadId: n.leadId, author: n.author, body: n.body, createdAt: n.createdAt.toISOString() }
}

function serializeCost(c: LeadCost) {
  return { id: c.id, leadId: c.leadId, type: c.type, amountUsd: Number(c.amountUsd), description: c.description, createdAt: c.createdAt.toISOString() }
}

type LeadDetailRecord = NonNullable<Awaited<ReturnType<typeof LeadService.detail>>>

function serializeDetail(lead: LeadDetailRecord) {
  return {
    ...serializeLead(lead),
    contacts: lead.contacts.map(serializeContact),
    notes: lead.notes.map(serializeNote),
    costs: lead.costs.map(serializeCost),
    emails: lead.emails.map(e => ({
      id: e.id,
      subject: e.subject,
      status: e.status,
      campaignName: e.campaignLead?.campaign.name ?? null,
      wasTestMode: e.wasTestMode,
      sentAt: iso(e.sentAt),
      events: e.events.map(ev => ({ type: ev.type, occurredAt: ev.occurredAt.toISOString() })),
    })),
  }
}

function serializeEnrichmentResponse(r: EnrichmentResponse) {
  return {
    id: r.id,
    provider: r.provider,
    operation: r.operation,
    success: r.success,
    error: r.error,
    costUsd: Number(r.costUsd),
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
    request: r.request,
    response: r.response,
  }
}

// ── Controller ──────────────────────────────────────────────────────────────────

interface LeadListQuery {
  [key: string]: string | undefined
  search?: string
  status?: string
  enrichmentStatus?: string
  industry?: string
  city?: string
  minScore?: string
  page?: string
  perPage?: string
}

interface LeadUpdateBody {
  status?: LeadStatus
  assignedTo?: string | null
  konciCustomerId?: string | null
  demoPhone?: string | null
  demoPin?: string | null
}

export default class LeadController extends Controller {
  // Error responses use real HTTP status codes so the frontend $api client throws.
  private fail(status: 400 | 404 | 409 | 422 | 502, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // GET /api/leads
  async index(req: AppRequest<{ Query: LeadListQuery }>) {
    const page = Math.max(1, Number(req.query.page) || 1)
    const perPage = Math.min(200, Math.max(1, Number(req.query.perPage) || 10))
    const result = await LeadService.list(this.prisma, {
      search: req.query.search || undefined,
      status: (req.query.status || undefined) as LeadStatus | undefined,
      enrichmentStatus: (req.query.enrichmentStatus || undefined) as EnrichmentStatus | undefined,
      industry: req.query.industry || undefined,
      city: req.query.city || undefined,
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
      page,
      perPage,
    })
    return this.data({ ...result, items: result.items.map(serializeLead) })
  }

  // GET /api/leads/industries
  async industries() {
    return this.data(await LeadService.industries(this.prisma))
  }

  // GET /api/leads/:id
  async show(req: AppRequest<{ Params: { id: string } }>) {
    const lead = await LeadService.detail(this.prisma, req.params.id)
    if (!lead)
      return this.fail(404, 'Lead not found')
    return this.data(serializeDetail(lead))
  }

  // POST /api/leads — manual create ("Add lead" form)
  async store(req: AppRequest<{ Body: LeadCreateData & { notes?: string } }>) {
    const body = req.body
    if (!body.name?.trim())
      return this.fail(400, 'Business name is required')

    const { lead, created } = await LeadService.create(this.prisma, body, 'MANUAL')
    if (!created)
      return this.fail(409, `Duplicate — "${lead.name}" already exists`, lead.id)

    if (body.notes?.trim()) {
      await this.prisma.leadNote.create({
        data: { leadId: lead.id, author: this.user?.email ?? 'owner', body: body.notes.trim() },
      })
    }
    const detail = await LeadService.detail(this.prisma, lead.id)
    return this.data(serializeDetail(detail!))
  }

  // PATCH /api/leads/:id
  async update(req: AppRequest<{ Params: { id: string }, Body: LeadUpdateBody }>) {
    const { status, assignedTo, konciCustomerId, demoPhone, demoPin } = req.body
    try {
      await this.prisma.lead.update({
        where: { id: req.params.id },
        data: {
          ...(status !== undefined && { status }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(konciCustomerId !== undefined && { konciCustomerId }),
          ...(demoPhone !== undefined && { demoPhone }),
          ...(demoPin !== undefined && { demoPin }),
        },
      })
    }
    catch {
      return this.fail(404, 'Lead not found')
    }
    const detail = await LeadService.detail(this.prisma, req.params.id)
    return this.data(serializeDetail(detail!))
  }

  // POST /api/leads/:id/enrich?force=true — runs the FULL waterfall synchronously
  // (30s–3min; the frontend holds the request open — see .claude/ENRICHMENT.md)
  async enrich(req: AppRequest<{ Params: { id: string }, Query: { force?: string } }>) {
    let guard
    try {
      guard = await EnrichmentService.enrich(this.prisma, this.c.env, req.params.id, req.query.force === 'true')
    }
    catch (err) {
      return this.fail(404, (err as Error).message)
    }
    if (guard?.skipped)
      return this.fail(422, guard.reason)

    const detail = await LeadService.detail(this.prisma, req.params.id)
    if (detail!.enrichmentStatus === 'FAILED')
      return this.fail(502, 'Enrichment failed', detail!.enrichmentError)
    return this.data(serializeDetail(detail!))
  }

  // POST /api/leads/:id/notes
  async addNote(req: AppRequest<{ Params: { id: string }, Body: { body?: string } }>) {
    if (!req.body.body?.trim())
      return this.fail(400, 'Note body is required')
    const note = await this.prisma.leadNote.create({
      data: { leadId: req.params.id, author: this.user?.email ?? 'owner', body: req.body.body.trim() },
    })
    return this.data(serializeNote(note))
  }

  // GET /api/leads/:id/enrichment-responses — the per-call audit ledger (Activity tab)
  async enrichmentResponses(req: AppRequest<{ Params: { id: string } }>) {
    const rows = await this.prisma.enrichmentResponse.findMany({
      where: { leadId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    return this.data(rows.map(serializeEnrichmentResponse))
  }

  // POST /api/leads/import/map-headers — LLM prefill for the CSV mapping step
  async mapHeaders(req: AppRequest<{ Body: { headers?: Array<string>, sampleRows?: Array<Record<string, string>> } }>) {
    if (!req.body.headers?.length)
      return this.fail(400, 'headers array is required')
    try {
      return this.data(await OpenrouterService.mapCsvHeaders(this.c.env, { headers: req.body.headers, sampleRows: req.body.sampleRows ?? [] }))
    }
    catch (err) {
      return this.fail(502, 'CSV header mapping failed', (err as Error).message)
    }
  }

  // POST /api/leads/import — mapped rows → dedup → create → report
  async importCsv(req: AppRequest<{ Body: { rows?: Array<Record<string, string>>, mapping?: Record<string, string | null> } }>) {
    const { rows, mapping } = req.body
    if (!rows?.length || !mapping)
      return this.fail(400, 'rows and mapping are required')
    if (!mapping.name)
      return this.fail(400, 'The mapping must include a column for the business name')
    return this.data(await LeadService.importRows(this.prisma, rows, mapping))
  }

  // POST /api/leads/scrapio/search — provider errors surface verbatim (403 until
  // the Scrap.io subscription has API access)
  async scrapioSearch(req: AppRequest<{ Body: { keyword?: string, location?: string, category?: string, excludeClosed?: boolean, hasWebsite?: boolean, hasPhone?: boolean, minRating?: number | null, minReviews?: number | null } }>) {
    const b = req.body
    try {
      const { results } = await ScrapioService.search(this.c.env, {
        type: b.category?.trim() || b.keyword?.trim() || undefined,
        location: b.location,
        minRating: b.minRating ?? undefined,
        minReviews: b.minReviews ?? undefined,
        requireWebsite: b.hasWebsite,
        requirePhone: b.hasPhone,
        excludeClosed: b.excludeClosed,
        perPage: 20,
      })
      return this.data(results)
    }
    catch (err) {
      return this.fail(502, 'Scrap.io search failed', (err as Error).message)
    }
  }

  // POST /api/leads/scrapio/import
  async scrapioImport(req: AppRequest<{ Body: { results?: Array<ScrapioResult> } }>) {
    if (!req.body.results?.length)
      return this.fail(400, 'results array is required')
    return this.data(await LeadService.importScrapioResults(this.prisma, req.body.results))
  }
}
