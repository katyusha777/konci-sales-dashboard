// Hunter.io — cheap targeted email finder.
// Base URL: https://api.hunter.io/v2 · Auth: api_key query parameter
// email-finder charges 1 credit ONLY when an email is found (~$0.017);
// domain-search charges 1 credit per request. API errors arrive in an errors[] array.

const BASE_URL = 'https://api.hunter.io/v2'

export interface HunterEmailResult {
  email: string
  confidence: number // normalized 1–10 (Hunter's raw score is 0–100)
  rawConfidence: number
  sources: Array<string>
  raw: unknown
}

export interface HunterDomainEmail {
  value: string
  confidence: number // raw 0–100
  type: 'personal' | 'generic'
  firstName: string | null
  lastName: string | null
  position: string | null
  seniority: string | null
  department: string | null
  linkedinUrl: string | null
  phoneNumber: string | null
  verificationStatus: string | null
}

export interface HunterDomainResult {
  pattern: string | null // e.g. "{first}.{last}"
  emails: Array<HunterDomainEmail>
  raw: unknown
}

export abstract class HunterService {
  /** Find the email of a specific person at a domain. All three inputs required. */
  static async findEmail(env: Env, input: { firstName: string, lastName: string, domain: string }): Promise<HunterEmailResult | null> {
    const url = new URL(`${BASE_URL}/email-finder`)
    url.searchParams.set('api_key', env.HUNTER_API_KEY)
    url.searchParams.set('domain', input.domain)
    url.searchParams.set('first_name', input.firstName)
    url.searchParams.set('last_name', input.lastName)

    const res = await fetch(url)
    if (res.status === 404)
      return null
    if (!res.ok)
      throw new Error(`Hunter email-finder error ${res.status}: ${await res.text()}`)

    const json = await res.json<{
      data?: { email?: string | null, confidence?: number | null, sources?: Array<{ uri?: string }> }
      errors?: Array<{ id: string, details: string }>
    }>()
    if (json.errors?.length || !json.data?.email)
      return null

    const rawConfidence = json.data.confidence ?? 50
    return {
      email: json.data.email,
      confidence: Math.max(1, Math.min(10, Math.round(rawConfidence / 10))),
      rawConfidence,
      sources: (json.data.sources ?? []).map(s => s.uri).filter((u): u is string => !!u),
      raw: json.data,
    }
  }

  /** All known emails at a domain + the domain's email pattern. type=personal skips info@/support@. */
  static async domainSearch(env: Env, domain: string, limit = 10, type: 'personal' | 'generic' | 'all' = 'personal'): Promise<HunterDomainResult> {
    const url = new URL(`${BASE_URL}/domain-search`)
    url.searchParams.set('api_key', env.HUNTER_API_KEY)
    url.searchParams.set('domain', domain)
    url.searchParams.set('limit', String(Math.min(limit, 100)))
    if (type !== 'all')
      url.searchParams.set('type', type)

    const res = await fetch(url)
    if (res.status === 404)
      return { pattern: null, emails: [], raw: null }
    if (!res.ok)
      throw new Error(`Hunter domain-search error ${res.status}: ${await res.text()}`)

    const json = await res.json<{
      data?: {
        pattern?: string | null
        emails?: Array<{
          value?: string
          confidence?: number
          type?: string
          first_name?: string | null
          last_name?: string | null
          position?: string | null
          seniority?: string | null
          department?: string | null
          linkedin?: string | null
          phone_number?: string | null
          verification?: { status?: string } | null
        }>
      }
      errors?: Array<{ id: string, details: string }>
    }>()
    if (json.errors?.length || !json.data)
      return { pattern: null, emails: [], raw: json }

    return {
      pattern: json.data.pattern ?? null,
      emails: (json.data.emails ?? []).map(e => ({
        value: e.value ?? '',
        confidence: e.confidence ?? 0,
        type: e.type === 'generic' ? 'generic' as const : 'personal' as const,
        firstName: e.first_name ?? null,
        lastName: e.last_name ?? null,
        position: e.position ?? null,
        seniority: e.seniority ?? null,
        department: e.department ?? null,
        linkedinUrl: e.linkedin ?? null,
        phoneNumber: e.phone_number ?? null,
        verificationStatus: e.verification?.status ?? null,
      })),
      raw: json.data,
    }
  }
}
