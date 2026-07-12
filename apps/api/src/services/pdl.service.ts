// PDL (People Data Labs) — primary contact-data provider.
// Base URL: https://api.peopledatalabs.com · Auth: X-Api-Key header
// Company enrich + person enrich are GET with query params (min_likelihood gate);
// people/company search are POST with a SQL query. See .claude/ENRICHMENT.md.

import { getHostname, isSharedDomain } from '../lib/website'

const BASE_URL = 'https://api.peopledatalabs.com'

interface PdlPerson {
  first_name?: string
  last_name?: string
  work_email?: string
  mobile_phone?: string
  phone_numbers?: Array<string>
  job_title?: string
  job_title_levels?: Array<string>
  linkedin_url?: string
}

export interface PdlCompanyResult {
  name: string | null
  industry: string | null
  employeeCount: number | null
  website: string | null
  linkedinUrl: string | null
  likelihood: number | null
  raw: unknown
}

export interface PdlPersonResult {
  firstName: string | null
  lastName: string | null
  workEmail: string | null
  phones: Array<string>
  jobTitle: string | null
  seniority: string | null
  linkedinUrl: string | null
  confidence: number
  source: string
  raw: unknown
}

export interface PdlCompanyInput {
  name: string
  website?: string
  city?: string
  state?: string
}

export interface PdlSearchPeopleInput {
  company: string
  city?: string
  state?: string
  companyLinkedinUrl?: string
  companyDomain?: string
  limit?: number
}

export interface PdlPersonInput {
  firstName?: string
  lastName?: string
  company?: string
  domain?: string
  linkedinUrl?: string
  email?: string
}

export abstract class PdlService {
  /** Company enrich by name + location (+ domain, unless it's a shared platform domain). ~$0.04 per match. */
  static async enrichCompany(env: Env, input: PdlCompanyInput): Promise<PdlCompanyResult | null> {
    const url = new URL(`${BASE_URL}/v5/company/enrich`)
    url.searchParams.set('name', input.name)
    if (input.city)
      url.searchParams.set('locality', input.city)
    if (input.state)
      url.searchParams.set('region', input.state)
    if (input.website && !isSharedDomain(input.website)) {
      const domain = getHostname(input.website)
      if (domain)
        url.searchParams.set('website', domain)
    }
    url.searchParams.set('min_likelihood', '3')

    const res = await fetch(url, { headers: { 'X-Api-Key': env.PDL_API_KEY } })
    if (res.status === 404)
      return null
    if (!res.ok)
      throw new Error(`PDL company enrich error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ likelihood: number, name?: string, industry?: string, employee_count?: number, website?: string, linkedin_url?: string }>()
    if (data.likelihood < 3)
      return null

    return {
      name: data.name ?? null,
      industry: data.industry ?? null,
      employeeCount: data.employee_count ?? null,
      website: data.website ?? null,
      linkedinUrl: data.linkedin_url ?? null,
      likelihood: data.likelihood,
      raw: data,
    }
  }

  /**
   * People search at a company (SQL API). Tier 1: owners/founders/C-suite;
   * Tier 2 fallback: any employee. Prefers company LinkedIn URL, then domain, then name.
   * ~$0.04 per API call.
   */
  static async searchPeople(env: Env, input: PdlSearchPeopleInput): Promise<{ tier: 'executives' | 'any_employee', results: Array<PdlPersonResult> }> {
    const escaped = input.company.replace(/\\/g, '\\\\').replace(/'/g, '\'\'')
    // PDL stores LinkedIn URLs without scheme/www
    const linkedin = input.companyLinkedinUrl?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

    const baseConditions = linkedin
      ? [`job_company_linkedin_url='${linkedin}'`]
      : input.companyDomain
        ? [`job_company_website='${input.companyDomain}'`]
        : [`job_company_name='${escaped}'`]
    if (input.city)
      baseConditions.push(`location_locality='${input.city}'`)
    if (input.state)
      baseConditions.push(`location_region='${input.state}'`)

    const runSearch = async (extraConditions: Array<string>): Promise<Array<PdlPersonResult>> => {
      const sql = `SELECT * FROM person WHERE ${[...baseConditions, ...extraConditions].join(' AND ')}`
      const res = await fetch(`${BASE_URL}/v5/person/search`, {
        method: 'POST',
        headers: { 'X-Api-Key': env.PDL_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, size: input.limit ?? 10 }),
      })
      if (res.status === 404)
        return []
      if (!res.ok)
        throw new Error(`PDL person search error ${res.status}: ${await res.text()}`)
      const data = await res.json<{ total: number, data?: Array<PdlPerson> }>()
      return (data.data ?? []).map(p => this.mapPerson(p, 7, 'pdl_search'))
    }

    const tier1 = await runSearch([
      `(job_title_role='owner' OR job_title_role='founder' OR job_title_role='cxo' OR job_title_levels='owner' OR job_title_levels='c_suite')`,
    ])
    if (tier1.length > 0)
      return { tier: 'executives', results: tier1 }
    return { tier: 'any_employee', results: await runSearch([]) }
  }

  /** Person enrich by any mix of name/email/LinkedIn (+ company context). ~$0.04 per match. */
  static async enrichPerson(env: Env, input: PdlPersonInput): Promise<PdlPersonResult | null> {
    // Need at least one person-identifying signal beyond just company
    if (!input.firstName && !input.lastName && !input.email && !input.linkedinUrl)
      return null

    const url = new URL(`${BASE_URL}/v5/person/enrich`)
    if (input.firstName)
      url.searchParams.set('first_name', input.firstName)
    if (input.lastName)
      url.searchParams.set('last_name', input.lastName)
    if (input.company)
      url.searchParams.set('company', input.company)
    if (input.domain && !isSharedDomain(input.domain))
      url.searchParams.set('company_domain', input.domain)
    if (input.linkedinUrl)
      url.searchParams.set('profile', input.linkedinUrl)
    if (input.email)
      url.searchParams.set('email', input.email)
    url.searchParams.set('min_likelihood', '4')

    const res = await fetch(url, { headers: { 'X-Api-Key': env.PDL_API_KEY } })
    if (res.status === 404)
      return null
    if (!res.ok)
      throw new Error(`PDL person enrich error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ likelihood: number, data: PdlPerson }>()
    if (data.likelihood < 4)
      return null
    return this.mapPerson(data.data, Math.min(10, Math.round(data.likelihood)), 'pdl')
  }

  /** Reverse lookup: person by email (work first, then personal). Search API pricing. */
  static async searchByEmail(env: Env, email: string): Promise<PdlPersonResult | null> {
    const escaped = email.replace(/'/g, '\\\'')
    const runSearch = async (sql: string): Promise<PdlPersonResult | null> => {
      const res = await fetch(`${BASE_URL}/v5/person/search`, {
        method: 'POST',
        headers: { 'X-Api-Key': env.PDL_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, size: 1 }),
      })
      if (res.status === 404)
        return null
      if (!res.ok)
        throw new Error(`PDL email search error ${res.status}: ${await res.text()}`)
      const data = await res.json<{ total: number, data?: Array<PdlPerson> }>()
      const p = data.data?.[0]
      return p ? this.mapPerson(p, 6, 'pdl_email_search') : null
    }

    return (
      await runSearch(`SELECT * FROM person WHERE work_email='${escaped}'`)
      ?? await runSearch(`SELECT * FROM person WHERE personal_emails='${escaped}'`)
    )
  }

  private static mapPerson(p: PdlPerson, confidence: number, source: string): PdlPersonResult {
    return {
      firstName: p.first_name ?? null,
      lastName: p.last_name ?? null,
      workEmail: typeof p.work_email === 'string' ? p.work_email : null,
      phones: [
        ...(p.mobile_phone ? [p.mobile_phone] : []),
        ...(Array.isArray(p.phone_numbers) ? p.phone_numbers : []),
      ],
      jobTitle: p.job_title ?? null,
      seniority: p.job_title_levels?.[0] ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      confidence,
      source,
      raw: p,
    }
  }
}
