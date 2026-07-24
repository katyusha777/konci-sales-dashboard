// Konci platform — internal leads API (staging): registers a lead on the main
// Konci system, which builds them a test account/dashboard and a claim link.
// Base URL: env.KONCI_API_URL · Auth: Bearer env.KONCI_LEADS_API_SECRET
// Pipeline is async: register returns 202/pending; poll until terminal
// (prepared | needs_phone | failed | skipped), usually ~80s.

export interface KonciRegisterInput {
  businessName: string
  website: string
  contactName?: string
  socialMedia?: string
  teamSize?: string
}

export interface KonciLeadResult {
  konciLeadId: string
  status: string // pending | prepared | needs_phone | failed | skipped
  claimUrl: string | null
  claimExpiresAt: string | null
  raw: unknown
}

export abstract class KonciService {
  private static async request<T>(env: Env, method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    if (!env.KONCI_LEADS_API_SECRET)
      throw new Error('KONCI_LEADS_API_SECRET is not set')
    const res = await fetch(`${env.KONCI_API_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${env.KONCI_LEADS_API_SECRET}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok)
      throw new Error(`Konci API error ${res.status}: ${await res.text()}`)
    return res.json<T>()
  }

  private static mapLead(data: Record<string, unknown>): KonciLeadResult {
    return {
      konciLeadId: String(data.lead_id ?? data.id ?? ''),
      status: String(data.status ?? 'pending'),
      claimUrl: (data.claim_url as string) ?? null,
      claimExpiresAt: (data.claim_expires_at as string) ?? null,
      raw: data,
    }
  }

  static async register(env: Env, input: KonciRegisterInput): Promise<KonciLeadResult> {
    const data = await this.request<Record<string, unknown>>(env, 'POST', '/api/internal/leads', {
      business_name: input.businessName,
      website: input.website,
      ...(input.contactName ? { contact_name: input.contactName } : {}),
      ...(input.socialMedia ? { social_media: input.socialMedia } : {}),
      ...(input.teamSize ? { team_size: input.teamSize } : {}),
    })
    return this.mapLead(data)
  }

  static async getLead(env: Env, konciLeadId: string): Promise<KonciLeadResult> {
    const data = await this.request<Record<string, unknown>>(env, 'GET', `/api/internal/leads/${konciLeadId}`)
    return this.mapLead(data)
  }

  // Only failed / needs_phone / skipped are retryable.
  static async retry(env: Env, konciLeadId: string): Promise<KonciLeadResult> {
    const data = await this.request<Record<string, unknown>>(env, 'POST', `/api/internal/leads/${konciLeadId}/retry`)
    return this.mapLead(data)
  }

  static async mintClaimLink(env: Env, konciLeadId: string): Promise<KonciLeadResult> {
    const data = await this.request<Record<string, unknown>>(env, 'POST', `/api/internal/leads/${konciLeadId}/claim-link`)
    return this.mapLead(data)
  }
}
