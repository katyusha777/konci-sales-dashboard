import type { IEnrichmentResponse, IImportReport, ILead, ILeadCreate, ILeadDetail, ILeadFilters, ILeadNote, IPaginated, IScrapioResult, IScrapioSearch, IScrapioSearchParams, IScrapioType } from '~/app/types'
import { $api } from './client'

export abstract class LeadsApi {
  static list(filters: ILeadFilters = {}): Promise<IPaginated<ILead>> {
    return $api('/api/leads', { query: filters })
  }

  static get(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}`)
  }

  static create(fields: ILeadCreate): Promise<ILeadDetail> {
    return $api('/api/leads', { method: 'POST', body: fields })
  }

  static update(id: string, fields: Partial<Pick<ILead, 'status' | 'assignedTo' | 'email' | 'outreachEmail' | 'konciCustomerId' | 'demoPhone' | 'demoPin'>>): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}`, { method: 'PATCH', body: fields })
  }

  // Runs the FULL waterfall synchronously — expect 30s–3min. force skips the
  // 30-day/3-attempt guard and re-attempts already-charged contacts.
  static enrich(id: string, force = false): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}/enrich`, { method: 'POST', query: force ? { force: 'true' } : undefined })
  }

  static addNote(id: string, body: string): Promise<ILeadNote> {
    return $api(`/api/leads/${id}/notes`, { method: 'POST', body: { body } })
  }

  // Bulk delete — related rows (contacts, videos, list memberships, …) cascade.
  static bulkDelete(leadIds: Array<string>): Promise<{ deleted: number }> {
    return $api('/api/leads/bulk-delete', { method: 'POST', body: { leadIds } })
  }

  static industries(): Promise<Array<string>> {
    return $api('/api/leads/industries')
  }

  // Per-provider-call audit ledger for the lead detail Activity tab
  static enrichmentResponses(id: string): Promise<Array<IEnrichmentResponse>> {
    return $api(`/api/leads/${id}/enrichment-responses`)
  }

  // CSV import: LLM prefills { targetField: csvHeader | null }, salesperson confirms
  static mapHeaders(headers: Array<string>, sampleRows: Array<Record<string, string>>): Promise<Record<string, string | null>> {
    return $api('/api/leads/import/map-headers', { method: 'POST', body: { headers, sampleRows } })
  }

  static importCsv(rows: Array<Record<string, string>>, mapping: Record<string, string | null>): Promise<IImportReport> {
    return $api('/api/leads/import', { method: 'POST', body: { rows, mapping } })
  }

  // "Find businesses" via Scrap.io — surfaces the provider error verbatim
  static scrapioSearch(params: IScrapioSearchParams): Promise<IScrapioSearch> {
    return $api('/api/leads/scrapio/search', { method: 'POST', body: params })
  }

  static scrapioTypes(): Promise<Array<IScrapioType>> {
    return $api('/api/leads/scrapio/types')
  }

  static scrapioImport(results: Array<IScrapioResult>): Promise<number> {
    return $api('/api/leads/scrapio/import', { method: 'POST', body: { results } })
  }

  // AI decision-maker pick (S4b). force re-picks over an existing choice.
  static pickOutreachEmail(id: string, force = false): Promise<{ picked: boolean, email?: string | null, reason: string | null, lead: ILeadDetail }> {
    return $api(`/api/leads/${id}/pick-outreach-email`, { method: 'POST', body: { force } })
  }

  // ── Konci platform registration (test account for the lead) ──
  static konciRegister(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}/konci/register`, { method: 'POST' })
  }

  static konciRefresh(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}/konci/refresh`, { method: 'POST' })
  }

  static konciRetry(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}/konci/retry`, { method: 'POST' })
  }

  static konciClaimLink(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}/konci/claim-link`, { method: 'POST' })
  }
}
