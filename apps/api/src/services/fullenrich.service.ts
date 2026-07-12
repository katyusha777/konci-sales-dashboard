// FullEnrich — expensive last-resort contact waterfall (aggregates 15+ vendors).
// Base URL: https://app.fullenrich.com/api/v2 · Auth: Authorization: Bearer <FULLENRICH_API_KEY>
// Enrich + reverse-email are ASYNC: submit returns an enrichmentId, results are polled.
// (The old repo polled inline for 30s; on Workers the caller polls — playground UI now,
// cron scheduler later.) People/company search are synchronous and free.

const BASE_URL = 'https://app.fullenrich.com/api/v2'

// Email status → normalized 1–10 confidence
const EMAIL_STATUS_CONFIDENCE: Record<string, number> = {
  DELIVERABLE: 9,
  HIGH_PROBABILITY: 7,
  CATCH_ALL: 4,
  UNKNOWN: 2,
  INVALID: 0,
}

interface FullenrichProfile {
  first_name?: string
  last_name?: string
  linkedin_url?: string
  social_profiles?: { linkedin?: { url?: string } }
  employment?: Array<{ title?: string, seniority?: string, company_name?: string, current?: boolean }> | {
    current?: { title?: string, company?: { name?: string, domain?: string } }
  }
}

interface FullenrichRecord {
  input?: Record<string, unknown>
  contact_info?: {
    emails?: Array<{ email: string, status: string }>
    personal_emails?: Array<{ email: string, status: string }>
    phones?: Array<string>
  }
  profile?: FullenrichProfile
}

export type FullenrichBulkStatus = 'CREATED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELED' | 'CREDITS_INSUFFICIENT' | 'RATE_LIMIT' | 'UNKNOWN'

export interface FullenrichContactResult {
  firstName: string | null
  lastName: string | null
  workEmail: string | null
  workEmailStatus: string | null
  personalEmail: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  linkedinUrl: string | null
  confidence: number
  source: string
  raw: unknown
}

export interface FullenrichPollResult {
  status: FullenrichBulkStatus
  /** null while still processing; populated when status is FINISHED */
  result: FullenrichContactResult | null
}

export interface FullenrichEnrichInput {
  firstName?: string
  lastName?: string
  company?: string
  domain?: string
  linkedinUrl?: string
}

export interface FullenrichCompanyResult {
  name: string | null
  domain: string | null
  linkedinUrl: string | null
  industry: string | null
  employeeCount: number | null
  raw: unknown
}

export abstract class FullenrichService {
  private static headers(env: Env) {
    return { 'Authorization': `Bearer ${env.FULLENRICH_API_KEY}`, 'Content-Type': 'application/json' }
  }

  /** Submit one contact for async enrichment (~$0.07 per matched contact). Poll with getEnrichResult(). */
  static async submitEnrich(env: Env, input: FullenrichEnrichInput): Promise<{ enrichmentId: string }> {
    const contact: Record<string, unknown> = {
      enrich_fields: ['contact.emails', 'contact.personal_emails', 'contact.phones'],
    }
    if (input.firstName)
      contact.first_name = input.firstName
    if (input.lastName)
      contact.last_name = input.lastName
    if (input.company)
      contact.company_name = input.company
    if (input.domain)
      contact.domain = input.domain
    if (input.linkedinUrl)
      contact.linkedin_url = input.linkedinUrl

    const res = await fetch(`${BASE_URL}/contact/enrich/bulk`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify({ name: `playground-enrich-${Date.now()}`, data: [contact] }),
    })
    if (!res.ok)
      throw new Error(`FullEnrich submit error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ enrichment_id?: string }>()
    if (!data.enrichment_id)
      throw new Error('FullEnrich submit returned no enrichment_id')
    return { enrichmentId: data.enrichment_id }
  }

  /** Poll an enrichment. status FINISHED → mapped result (or null if the match was too weak). */
  static async getEnrichResult(env: Env, enrichmentId: string): Promise<FullenrichPollResult> {
    const res = await fetch(`${BASE_URL}/contact/enrich/bulk/${enrichmentId}`, { headers: this.headers(env) })
    if (!res.ok)
      throw new Error(`FullEnrich poll error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ status: FullenrichBulkStatus, data?: Array<FullenrichRecord> }>()
    if (data.status === 'CREDITS_INSUFFICIENT')
      throw new Error('FullEnrich: insufficient credits')
    if (data.status !== 'FINISHED')
      return { status: data.status, result: null }

    const record = data.data?.[0]
    return { status: 'FINISHED', result: record ? this.mapRecord(record) : null }
  }

  /** Submit a reverse email lookup (~$0.03). Poll with getReverseEmailResult(). */
  static async submitReverseEmail(env: Env, email: string): Promise<{ enrichmentId: string }> {
    const res = await fetch(`${BASE_URL}/contact/reverse/email/bulk`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify({ name: `playground-reverse-${Date.now()}`, data: [{ email }] }),
    })
    if (!res.ok)
      throw new Error(`FullEnrich reverse email submit error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ enrichment_id?: string }>()
    if (!data.enrichment_id)
      throw new Error('FullEnrich reverse email submit returned no enrichment_id')
    return { enrichmentId: data.enrichment_id }
  }

  /** Poll a reverse email lookup. Name + LinkedIn is still valuable even without a work email. */
  static async getReverseEmailResult(env: Env, enrichmentId: string): Promise<FullenrichPollResult> {
    const res = await fetch(`${BASE_URL}/contact/reverse/email/bulk/${enrichmentId}`, { headers: this.headers(env) })
    if (!res.ok)
      throw new Error(`FullEnrich reverse email poll error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ status: FullenrichBulkStatus, data?: Array<FullenrichRecord> }>()
    if (data.status === 'CREDITS_INSUFFICIENT')
      throw new Error('FullEnrich: insufficient credits')
    if (data.status !== 'FINISHED')
      return { status: data.status, result: null }

    const profile = data.data?.[0]?.profile
    if (!profile)
      return { status: 'FINISHED', result: null }

    const currentJob = this.currentEmployment(profile)
    return {
      status: 'FINISHED',
      result: {
        firstName: profile.first_name ?? null,
        lastName: profile.last_name ?? null,
        workEmail: null,
        workEmailStatus: null,
        personalEmail: null,
        phones: [],
        jobTitle: currentJob?.title ?? null,
        seniority: null,
        linkedinUrl: profile.social_profiles?.linkedin?.url ?? profile.linkedin_url ?? null,
        confidence: profile.first_name || profile.last_name ? 6 : 0,
        source: 'fullenrich_reverse_email',
        raw: profile,
      },
    }
  }

  /**
   * Submit a BATCH of reverse email lookups (~$0.03 each). Poll with getReverseEmailBatchResult().
   * The API rejects oversized batches with error.enrichment.data.too_many (no documented limit —
   * the old flow used max 100 and halved on rejection; that retry loop belongs to the caller).
   */
  static async submitReverseEmailBatch(env: Env, emails: Array<string>): Promise<{ enrichmentId: string, count: number }> {
    if (emails.length === 0)
      throw new Error('At least one email is required')

    const res = await fetch(`${BASE_URL}/contact/reverse/email/bulk`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify({ name: `playground-reverse-batch-${Date.now()}`, data: emails.map(email => ({ email })) }),
    })
    if (!res.ok) {
      const body = await res.text()
      if (body.includes('error.enrichment.data.too_many'))
        throw new Error(`FullEnrich batch too large (${emails.length} emails) — split it and resubmit smaller batches`)
      throw new Error(`FullEnrich reverse email batch submit error ${res.status}: ${body}`)
    }

    const data = await res.json<{ enrichment_id?: string }>()
    if (!data.enrichment_id)
      throw new Error('FullEnrich reverse email batch submit returned no enrichment_id')
    return { enrichmentId: data.enrichment_id, count: emails.length }
  }

  /** Poll a reverse email batch. FINISHED → one entry per submitted email (result null = no match). */
  static async getReverseEmailBatchResult(env: Env, enrichmentId: string): Promise<{ status: FullenrichBulkStatus, results: Array<{ email: string, result: FullenrichContactResult | null }> | null }> {
    const res = await fetch(`${BASE_URL}/contact/reverse/email/bulk/${enrichmentId}`, { headers: this.headers(env) })
    if (!res.ok)
      throw new Error(`FullEnrich reverse email batch poll error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ status: FullenrichBulkStatus, data?: Array<FullenrichRecord & { input?: { email?: string } }> }>()
    if (data.status === 'CREDITS_INSUFFICIENT')
      throw new Error('FullEnrich: insufficient credits')
    if (data.status !== 'FINISHED')
      return { status: data.status, results: null }

    const results = (data.data ?? []).map((record) => {
      const email = (record.input as { email?: string } | undefined)?.email ?? ''
      const profile = record.profile
      if (!profile)
        return { email, result: null }
      const currentJob = this.currentEmployment(profile)
      return {
        email,
        result: {
          firstName: profile.first_name ?? null,
          lastName: profile.last_name ?? null,
          workEmail: null,
          workEmailStatus: null,
          personalEmail: null,
          phones: [],
          jobTitle: currentJob?.title ?? null,
          seniority: null,
          linkedinUrl: profile.social_profiles?.linkedin?.url ?? profile.linkedin_url ?? null,
          confidence: profile.first_name || profile.last_name ? 6 : 0,
          source: 'fullenrich_reverse_email_batch',
          raw: profile,
        } satisfies FullenrichContactResult,
      }
    })
    return { status: 'FINISHED', results }
  }

  /** Synchronous people search at a company. Free — but returns NO emails/phones (enrich separately). */
  static async searchPeople(env: Env, input: { company?: string, domain?: string, city?: string, state?: string, limit?: number }): Promise<Array<FullenrichContactResult>> {
    const body: Record<string, unknown> = { limit: input.limit ?? 10 }
    if (input.company)
      body.current_company_names = [{ value: input.company }]
    if (input.domain)
      body.current_company_domains = [{ value: input.domain }]
    if (input.city || input.state)
      body.person_locations = [{ value: [input.city, input.state].filter(Boolean).join(', ') }]

    const res = await fetch(`${BASE_URL}/people/search`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify(body),
    })
    if (!res.ok)
      throw new Error(`FullEnrich people search error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ people?: Array<FullenrichProfile>, metadata?: { total?: number } }>()
    return (data.people ?? []).flatMap((p) => {
      if (!p.first_name && !p.last_name)
        return []
      const currentJob = this.currentEmployment(p)
      return [{
        firstName: p.first_name ?? null,
        lastName: p.last_name ?? null,
        workEmail: null,
        workEmailStatus: null,
        personalEmail: null,
        phones: [],
        jobTitle: currentJob?.title ?? null,
        seniority: null,
        linkedinUrl: p.social_profiles?.linkedin?.url ?? null,
        confidence: 4,
        source: 'fullenrich_people_search',
        raw: p,
      }]
    })
  }

  /** Synchronous company search. Free. Returns best match or null. */
  static async searchCompany(env: Env, input: { name: string, domain?: string, city?: string, state?: string }): Promise<FullenrichCompanyResult | null> {
    const body: Record<string, unknown> = { limit: 1, names: [{ value: input.name }] }
    if (input.domain)
      body.domains = [{ value: input.domain }]
    if (input.city || input.state)
      body.headquarters_locations = [{ value: [input.city, input.state].filter(Boolean).join(', ') }]

    const res = await fetch(`${BASE_URL}/company/search`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify(body),
    })
    if (!res.ok)
      throw new Error(`FullEnrich company search error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ companies?: Array<{ name?: string, domain?: string, social_profiles?: { linkedin?: { url?: string } }, industry?: { name?: string }, headcount?: number }> }>()
    const company = data.companies?.[0]
    if (!company)
      return null

    return {
      name: company.name ?? null,
      domain: company.domain ?? null,
      linkedinUrl: company.social_profiles?.linkedin?.url ?? null,
      industry: company.industry?.name ?? null,
      employeeCount: company.headcount ?? null,
      raw: company,
    }
  }

  private static currentEmployment(profile: FullenrichProfile): { title?: string, seniority?: string } | undefined {
    if (Array.isArray(profile.employment))
      return profile.employment.find(e => e.current)
    return profile.employment?.current
  }

  private static mapRecord(record: FullenrichRecord): FullenrichContactResult | null {
    const emails = record.contact_info?.emails ?? []
    const personalEmails = record.contact_info?.personal_emails ?? []
    const phones = record.contact_info?.phones ?? []
    const currentJob = record.profile ? this.currentEmployment(record.profile) : undefined

    // Best work email by status confidence
    const bestEmail = [...emails].sort(
      (a, b) => (EMAIL_STATUS_CONFIDENCE[b.status] ?? 0) - (EMAIL_STATUS_CONFIDENCE[a.status] ?? 0),
    )[0]

    const linkedinUrl = record.profile?.linkedin_url ?? record.profile?.social_profiles?.linkedin?.url ?? null
    const confidence = bestEmail
      ? (EMAIL_STATUS_CONFIDENCE[bestEmail.status] ?? 2)
      : phones.length > 0 || linkedinUrl ? 5 : 0

    if (confidence === 0)
      return null

    return {
      firstName: record.profile?.first_name ?? null,
      lastName: record.profile?.last_name ?? null,
      workEmail: bestEmail?.email ?? null,
      workEmailStatus: bestEmail?.status ?? null,
      personalEmail: personalEmails[0]?.email ?? null,
      phones,
      jobTitle: currentJob?.title ?? null,
      seniority: currentJob?.seniority ?? null,
      linkedinUrl,
      confidence,
      source: 'fullenrich',
      raw: record,
    }
  }
}
