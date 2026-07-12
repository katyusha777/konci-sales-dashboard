import type { IEnrichmentResponse, IImportReport, ILead, ILeadCreate, ILeadDetail, ILeadFilters, ILeadNote, IPaginated, IScrapioResult, IScrapioSearchParams } from '~/app/types'
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

  static update(id: string, fields: Partial<Pick<ILead, 'status' | 'assignedTo' | 'konciCustomerId' | 'demoPhone' | 'demoPin'>>): Promise<ILeadDetail> {
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
  // (403 until the Scrap.io subscription includes API access)
  static scrapioSearch(params: IScrapioSearchParams): Promise<Array<IScrapioResult>> {
    return $api('/api/leads/scrapio/search', { method: 'POST', body: params })
  }

  static scrapioImport(results: Array<IScrapioResult>): Promise<number> {
    return $api('/api/leads/scrapio/import', { method: 'POST', body: { results } })
  }
}
