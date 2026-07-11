import type { ILead, ILeadDetail, ILeadFilters, ILeadNote, IPaginated, IScrapioResult, IScrapioSearchParams } from '~/app/types'
import { dummyLeadDetail, dummyLeads, dummyNotes } from '~/app/dummy-data/leads'
import { dummy } from './client'

// DUMMY-BACKED (frontend-first phase). Signatures are the API contract —
// swapping internals to $api calls must not change any page.
export abstract class LeadsApi {
  static async list(filters: ILeadFilters = {}): Promise<IPaginated<ILead>> {
    const { search, status, enrichmentStatus, industry, city, minScore, page = 1, perPage = 10 } = filters
    let items = dummyLeads.slice()
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(l => l.name.toLowerCase().includes(q) || l.domain?.includes(q) || l.city?.toLowerCase().includes(q))
    }
    if (status)
      items = items.filter(l => l.status === status)
    if (enrichmentStatus)
      items = items.filter(l => l.enrichmentStatus === enrichmentStatus)
    if (industry)
      items = items.filter(l => l.industry === industry)
    if (city)
      items = items.filter(l => l.city === city)
    if (minScore !== undefined)
      items = items.filter(l => l.enrichmentScore >= minScore)
    const total = items.length
    items = items.slice((page - 1) * perPage, page * perPage)
    return dummy({ items, total, page, perPage })
  }

  static async get(id: string): Promise<ILeadDetail> {
    const detail = dummyLeadDetail(id)
    if (!detail)
      throw new Error('Lead not found')
    return dummy(detail)
  }

  static async update(id: string, fields: Partial<Pick<ILead, 'status' | 'assignedTo' | 'konciCustomerId' | 'demoPhone' | 'demoPin'>>): Promise<ILeadDetail> {
    const lead = dummyLeads.find(l => l.id === id)
    if (lead)
      Object.assign(lead, fields, { updatedAt: new Date().toISOString() })
    return this.get(id)
  }

  static async enrich(id: string): Promise<ILeadDetail> {
    const lead = dummyLeads.find(l => l.id === id)
    if (lead) {
      lead.enrichmentStatus = 'COMPLETED'
      lead.enrichmentScore = Math.min(100, lead.enrichmentScore + 40)
      lead.enrichmentAttempts += 1
      lead.lastEnrichedAt = new Date().toISOString()
      if (lead.status === 'NEW')
        lead.status = 'ENRICHED'
    }
    return dummy(await this.get(id), 1200)
  }

  static async addNote(id: string, body: string): Promise<ILeadNote> {
    const note: ILeadNote = {
      id: `nt_${Date.now()}`,
      leadId: id,
      author: useAuth().user.value?.email ?? 'me',
      body,
      createdAt: new Date().toISOString(),
    }
    ;(dummyNotes[id] ??= []).unshift(note)
    return dummy(note, 150)
  }

  static industries(): Promise<Array<string>> {
    return dummy([...new Set(dummyLeads.map(l => l.industry).filter((v): v is string => !!v))].sort())
  }

  // "Find businesses" via Scrap.io — dummy generates plausible results.
  static async scrapioSearch(params: IScrapioSearchParams): Promise<Array<IScrapioResult>> {
    const keyword = params.keyword.trim() || params.category.trim() || 'business'
    const kind = keyword.charAt(0).toUpperCase() + keyword.slice(1)
    const [city = 'Austin', state = 'TX'] = params.location.split(',').map(s => s.trim()).filter(Boolean)
    const names = ['Premier', 'Elite', 'Golden Gate', 'Family First', 'Metro', 'Sunrise', 'Blue Sky', 'All-Star', 'Trusted', 'Neighborhood']
    const results = names.map((prefix, i) => ({
      externalId: `gmap_${keyword.replace(/\W/g, '')}_${i}`,
      name: `${prefix} ${kind}`,
      city,
      state: state.toUpperCase().slice(0, 2),
      industry: kind,
      rating: Math.round((3.6 + (i % 5) * 0.3) * 10) / 10,
      reviewCount: 12 + i * 37,
      website: i % 4 === 3 ? null : `https://${prefix.toLowerCase().replace(/\W/g, '')}${keyword.replace(/\W/g, '')}.com`,
      phone: i % 5 === 4 ? null : `+1512555${2000 + i}`,
    }))
    return dummy(results.filter(r =>
      (!params.hasWebsite || r.website)
      && (!params.hasPhone || r.phone)
      && (params.minRating === null || r.rating >= params.minRating)
      && (params.minReviews === null || r.reviewCount >= params.minReviews),
    ), 900)
  }

  static async scrapioImport(results: Array<IScrapioResult>): Promise<number> {
    for (const r of results) {
      dummyLeads.unshift({
        id: `lead_${Date.now()}_${r.externalId}`,
        name: r.name,
        domain: r.website ? new URL(r.website).hostname : null,
        website: r.website,
        email: null,
        phone: r.phone,
        street: null,
        city: r.city,
        state: r.state,
        postalCode: null,
        country: 'US',
        industry: r.industry,
        categories: [r.industry],
        googleRating: r.rating,
        googleReviewCount: r.reviewCount,
        employeeCount: null,
        services: [],
        businessHours: null,
        description: null,
        ownerName: null,
        source: 'SCRAPIO',
        status: 'NEW',
        enrichmentStatus: 'PENDING',
        enrichmentScore: 0,
        enrichmentAttempts: 0,
        lastEnrichedAt: null,
        assignedTo: null,
        lastContactedAt: null,
        lastEngagedAt: null,
        konciCustomerId: null,
        demoPhone: null,
        demoPin: null,
        totalCostUsd: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return dummy(results.length, 500)
  }
}
