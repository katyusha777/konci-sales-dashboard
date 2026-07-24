// Lead domain logic: dedup-aware creation (manual / CSV / Scrap.io), list filtering,
// CSV row import, and the enrichment score. Dedup waterfall (ported from the old repo's
// leads.service.ts): googlePlaceId → domain key → name+city.

import type { createPrisma } from '../lib/prisma'
import type { EnrichmentStatus, LeadSource, LeadStatus, Prisma } from '../generated/prisma/client'
import type { ScrapioResult } from './scrapio.service'
import { getHostname, isSharedDomain } from '../lib/website'

type PrismaClient = ReturnType<typeof createPrisma>

/** Normalized host used as the dedup key — undefined for shared platforms (vagaro, linktree…). */
export function domainKey(website?: string | null): string | undefined {
  if (!website)
    return undefined
  if (isSharedDomain(website))
    return undefined
  return getHostname(website) ?? undefined
}

export interface LeadCreateData {
  name: string
  website?: string | null
  email?: string | null
  phone?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  industry?: string | null
  categories?: Array<string>
  googleRating?: number | null
  googleReviewCount?: number | null
  employeeCount?: number | null
  googlePlaceId?: string | null
  socialLinks?: Record<string, string> | null
}

export interface LeadListFilters {
  search?: string
  status?: LeadStatus
  enrichmentStatus?: EnrichmentStatus
  industry?: string
  city?: string
  minScore?: number
  page: number
  perPage: number
}

export interface ImportReport {
  created: number
  duplicates: number
  errors: Array<{ row: number, error: string }>
}

// CSV mapping targets that land on the contact instead of the lead
const CONTACT_CSV_KEYS = ['contact_first_name', 'contact_last_name', 'contact_email', 'contact_phone', 'contact_title', 'contact_linkedin_url'] as const
const SOCIAL_CSV_KEYS = [['facebook_url', 'facebook'], ['instagram_url', 'instagram'], ['linkedin_url', 'linkedin'], ['twitter_url', 'twitter'], ['youtube_url', 'youtube']] as const

export abstract class LeadService {
  /**
   * Create a lead unless a duplicate exists. Dedup waterfall:
   * googlePlaceId (authoritative) → domain key (skips shared platforms) →
   * normalized name + city (deterministic — no LLM fuzzy pass in V1).
   */
  static async create(prisma: PrismaClient, data: LeadCreateData, source: LeadSource, sourceMeta?: Prisma.InputJsonValue) {
    const dk = domainKey(data.website)

    if (data.googlePlaceId) {
      const existing = await prisma.lead.findUnique({ where: { googlePlaceId: data.googlePlaceId } })
      if (existing)
        return { lead: existing, created: false }
    }
    if (dk) {
      const existing = await prisma.lead.findUnique({ where: { domain: dk } })
      if (existing)
        return { lead: existing, created: false }
    }
    if (!dk && data.city) {
      const existing = await prisma.lead.findFirst({
        where: { name: { equals: data.name.trim(), mode: 'insensitive' }, city: { equals: data.city.trim(), mode: 'insensitive' } },
      })
      if (existing)
        return { lead: existing, created: false }
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name.trim(),
        domain: dk,
        googlePlaceId: data.googlePlaceId || undefined,
        website: data.website?.trim() || undefined,
        email: data.email?.trim().toLowerCase() || undefined,
        phone: data.phone?.trim() || undefined,
        street: data.street?.trim() || undefined,
        city: data.city?.trim() || undefined,
        state: data.state?.trim() || undefined,
        postalCode: data.postalCode?.trim() || undefined,
        country: data.country?.trim() || undefined,
        industry: data.industry?.trim() || undefined,
        categories: data.categories ?? [],
        googleRating: data.googleRating ?? undefined,
        googleReviewCount: data.googleReviewCount ?? undefined,
        employeeCount: data.employeeCount ?? undefined,
        socialLinks: data.socialLinks ?? undefined,
        source,
        sourceMeta,
      },
    })
    return { lead, created: true }
  }

  /**
   * Import already-parsed CSV rows using a { targetField: csvHeader | null } mapping
   * (the LLM prefills it, the salesperson confirms it — see OpenrouterService.mapCsvHeaders).
   */
  static async importRows(prisma: PrismaClient, rows: Array<Record<string, string>>, mapping: Record<string, string | null>): Promise<ImportReport> {
    const report: ImportReport = { created: 0, duplicates: 0, errors: [] }
    const pick = (row: Record<string, string>, key: string): string | undefined => {
      const header = mapping[key]
      const value = header ? row[header]?.trim() : undefined
      return value || undefined
    }
    const num = (v: string | undefined): number | undefined => {
      const n = v ? Number(v.replace(/[^\d.\-]/g, '')) : Number.NaN
      return Number.isFinite(n) ? n : undefined
    }

    for (const [i, row] of rows.entries()) {
      const name = pick(row, 'name')
      if (!name) {
        report.errors.push({ row: i + 1, error: 'Missing business name' })
        continue
      }
      try {
        const socialLinks: Record<string, string> = {}
        for (const [csvKey, jsonKey] of SOCIAL_CSV_KEYS) {
          const url = pick(row, csvKey)
          if (url)
            socialLinks[jsonKey] = url
        }

        const { lead, created } = await this.create(prisma, {
          name,
          website: pick(row, 'website'),
          email: pick(row, 'email'),
          phone: pick(row, 'phone'),
          street: pick(row, 'street'),
          city: pick(row, 'city'),
          state: pick(row, 'state'),
          postalCode: pick(row, 'postal_code'),
          country: pick(row, 'country'),
          industry: pick(row, 'industry'),
          googleRating: num(pick(row, 'google_rating')),
          googleReviewCount: num(pick(row, 'google_review_count')),
          employeeCount: num(pick(row, 'employee_count')),
          googlePlaceId: pick(row, 'google_id') ?? pick(row, 'place_id'),
          socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
        }, 'CSV')

        if (!created) {
          report.duplicates++
          continue
        }
        report.created++

        const contactValues = Object.fromEntries(CONTACT_CSV_KEYS.map(k => [k, pick(row, k)]))
        if (contactValues.contact_first_name || contactValues.contact_last_name || contactValues.contact_email) {
          await prisma.contact.create({
            data: {
              leadId: lead.id,
              firstName: contactValues.contact_first_name,
              lastName: contactValues.contact_last_name,
              email: contactValues.contact_email?.toLowerCase(),
              phone: contactValues.contact_phone,
              jobTitle: contactValues.contact_title,
              linkedinUrl: contactValues.contact_linkedin_url,
              priority: 1,
              source: 'CSV',
            },
          })
        }
      }
      catch (err) {
        report.errors.push({ row: i + 1, error: (err as Error).message })
      }
    }
    return report
  }

  /** Import selected Scrap.io search results as leads (source SCRAPIO). */
  static async importScrapioResults(prisma: PrismaClient, results: Array<ScrapioResult>): Promise<number> {
    let created = 0
    for (const r of results) {
      const { created: isNew } = await this.create(prisma, {
        name: r.name,
        website: r.website,
        email: r.email,
        phone: r.phone,
        street: r.street,
        city: r.city,
        state: r.state,
        postalCode: r.postalCode,
        country: r.country,
        industry: r.industry,
        categories: r.categories,
        googleRating: r.rating,
        googleReviewCount: r.reviewCount,
        googlePlaceId: r.googleId ?? r.placeId,
        socialLinks: r.socialLinks,
      }, 'SCRAPIO')
      if (isNew)
        created++
    }
    return created
  }

  static async list(prisma: PrismaClient, filters: LeadListFilters) {
    const where: Prisma.LeadWhereInput = {}
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { domain: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ]
    }
    if (filters.status)
      where.status = filters.status
    if (filters.enrichmentStatus)
      where.enrichmentStatus = filters.enrichmentStatus
    if (filters.industry)
      where.industry = filters.industry
    if (filters.city)
      where.city = { equals: filters.city, mode: 'insensitive' }
    if (filters.minScore !== undefined)
      where.enrichmentScore = { gte: filters.minScore }

    const [total, items] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ])
    return { items, total, page: filters.page, perPage: filters.perPage }
  }

  // Bulk delete — related rows cascade (contacts, videos, members, registration, …).
  static async removeMany(prisma: PrismaClient, ids: Array<string>): Promise<number> {
    const result = await prisma.lead.deleteMany({ where: { id: { in: ids } } })
    return result.count
  }

  static detail(prisma: PrismaClient, id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { priority: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        costs: { orderBy: { createdAt: 'desc' } },
        emails: {
          orderBy: { createdAt: 'desc' },
          include: {
            events: { orderBy: { occurredAt: 'asc' } },
          },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
          include: { template: { select: { name: true } } },
        },
        konciRegistration: true,
        providerEmailStats: { orderBy: [{ sequenceNumber: 'asc' }] },
      },
    })
  }

  /**
   * Enrichment score, 0–100 (plan §4 — dumb and transparent):
   * website +15 · email +15 · phone +10 · rating ≥ 4.0 +10 · reviews ≥ 20 +10 ·
   * ≥1 contact with usable email +25 · industry known +5 · socials found +10.
   */
  static computeScore(
    lead: { website: string | null, email: string | null, phone: string | null, googleRating: number | null, googleReviewCount: number | null, industry: string | null, socialLinks: unknown },
    contacts: Array<{ email: string | null, emailStatus: string }>,
  ): number {
    let score = 0
    if (lead.website)
      score += 15
    if (lead.email)
      score += 15
    if (lead.phone)
      score += 10
    if ((lead.googleRating ?? 0) >= 4.0)
      score += 10
    if ((lead.googleReviewCount ?? 0) >= 20)
      score += 10
    if (contacts.some(c => c.email && !['BOUNCED', 'UNSUBSCRIBED', 'COMPLAINED'].includes(c.emailStatus)))
      score += 25
    if (lead.industry)
      score += 5
    if (lead.socialLinks && Object.keys(lead.socialLinks as object).length > 0)
      score += 10
    return Math.min(100, score)
  }

  static async industries(prisma: PrismaClient): Promise<Array<string>> {
    const rows = await prisma.lead.findMany({
      where: { industry: { not: null } },
      select: { industry: true },
      distinct: ['industry'],
      orderBy: { industry: 'asc' },
    })
    return rows.map(r => r.industry!).filter(Boolean)
  }
}
