// Apollo.io — contact enrichment (person match).
// Base URL: https://api.apollo.io/v1 · Auth: x-api-key header

const BASE_URL = 'https://api.apollo.io/v1'

export interface ApolloMatchInput {
  firstName?: string
  lastName?: string
  organizationName?: string
  domain?: string
  linkedinUrl?: string
  email?: string
}

export interface ApolloMatchResult {
  workEmail: string | null
  emailStatus: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  department: string | null
  linkedinUrl: string | null
  isLikelyToEngage: boolean | null
  confidence: number
  raw: unknown
}

export interface ApolloOrgResult {
  name: string | null
  domain: string | null
  websiteUrl: string | null
  industry: string | null
  employeeCount: number | null
  annualRevenue: number | null
  foundedYear: number | null
  linkedinUrl: string | null
  phone: string | null
  city: string | null
  state: string | null
  raw: unknown
}

export abstract class ApolloService {
  // Returns null when Apollo has no match (404/422) or the email is invalid.
  static async matchPerson(env: Env, input: ApolloMatchInput): Promise<ApolloMatchResult | null> {
    const body: Record<string, string> = {}
    if (input.firstName)
      body.first_name = input.firstName
    if (input.lastName)
      body.last_name = input.lastName
    if (input.organizationName)
      body.organization_name = input.organizationName
    if (input.domain)
      body.domain = input.domain
    if (input.linkedinUrl)
      body.linkedin_url = input.linkedinUrl
    if (input.email)
      body.email = input.email

    const res = await fetch(`${BASE_URL}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': env.APOLLO_API_KEY,
      },
      body: JSON.stringify(body),
    })

    if (res.status === 404 || res.status === 422)
      return null
    if (!res.ok)
      throw new Error(`Apollo error ${res.status}: ${await res.text()}`)

    const data = await res.json<{
      person?: {
        email?: string
        email_status?: string
        phone_numbers?: Array<{ raw_number: string }>
        title?: string
        seniority?: string
        departments?: Array<string>
        linkedin_url?: string
        is_likely_to_engage?: boolean
      }
    }>()

    if (!data.person || data.person.email_status === 'invalid')
      return null

    return {
      workEmail: data.person.email ?? null,
      emailStatus: data.person.email_status ?? null,
      phones: (data.person.phone_numbers ?? []).map(p => p.raw_number),
      jobTitle: data.person.title ?? null,
      seniority: data.person.seniority ?? null,
      department: data.person.departments?.[0] ?? null,
      linkedinUrl: data.person.linkedin_url ?? null,
      isLikelyToEngage: data.person.is_likely_to_engage ?? null,
      // Apollo "verified" email = high confidence
      confidence: data.person.email_status === 'verified' ? 9 : 5,
      raw: data.person,
    }
  }

  // Organization enrich by domain — separate endpoint from people/match,
  // may be available on plans where person match is gated.
  static async enrichOrganization(env: Env, domain: string): Promise<ApolloOrgResult | null> {
    const res = await fetch(`${BASE_URL}/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'x-api-key': env.APOLLO_API_KEY,
      },
    })

    if (res.status === 404 || res.status === 422)
      return null
    if (!res.ok)
      throw new Error(`Apollo error ${res.status}: ${await res.text()}`)

    const data = await res.json<{
      organization?: {
        name?: string
        primary_domain?: string
        website_url?: string
        industry?: string
        estimated_num_employees?: number
        annual_revenue?: number
        founded_year?: number
        linkedin_url?: string
        phone?: string
        city?: string
        state?: string
      }
    }>()

    if (!data.organization)
      return null

    const org = data.organization
    return {
      name: org.name ?? null,
      domain: org.primary_domain ?? null,
      websiteUrl: org.website_url ?? null,
      industry: org.industry ?? null,
      employeeCount: org.estimated_num_employees ?? null,
      annualRevenue: org.annual_revenue ?? null,
      foundedYear: org.founded_year ?? null,
      linkedinUrl: org.linkedin_url ?? null,
      phone: org.phone ?? null,
      city: org.city ?? null,
      state: org.state ?? null,
      raw: org,
    }
  }
}
