// Smartlead — cold email sending provider (campaigns, leads, stats).
// Base URL: https://server.smartlead.ai/api/v1 · Auth: ?api_key= query param
// See .claude/smartlead-integration.md before building on this.

const BASE_URL = 'https://server.smartlead.ai/api/v1'

export interface SmartleadCampaign {
  id: number
  name: string
  status: string // DRAFTED | ACTIVE | PAUSED | STOPPED | ARCHIVED
  createdAt: string | null
  maxLeadsPerDay: number | null
  minTimeBtwnEmails: number | null
  timezone: string | null
  raw: unknown
}

export interface SmartleadAnalytics {
  campaignName: string | null
  status: string | null
  totalLeads: number | null
  sentCount: number | null
  openCount: number | null
  clickCount: number | null
  replyCount: number | null
  bounceCount: number | null
  unsubscribedCount: number | null
  raw: unknown
}

export interface SmartleadLeadStat {
  leadEmail: string | null
  leadName: string | null
  sequenceNumber: number | null
  emailSubject: string | null
  sentTime: string | null
  openTime: string | null
  openCount: number | null
  clickTime: string | null
  clickCount: number | null
  replyTime: string | null
  isBounced: boolean
  raw: unknown
}

export interface SmartleadCampaignLead {
  smartleadLeadId: number | null
  email: string | null
  firstName: string | null
  lastName: string | null
  companyName: string | null
  status: string | null // STARTED | INPROGRESS | COMPLETED | BLOCKED
  createdAt: string | null
  raw: unknown
}

export interface SmartleadPushLead {
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  website?: string
  phoneNumber?: string
  location?: string
  linkedinProfile?: string
  customFields?: Record<string, string>
}

export interface SmartleadPushResult {
  addedCount: number | null
  skippedCount: number | null
  skippedLeads: unknown
  raw: unknown
}

export interface SmartleadEmailAccount {
  id: number | null
  fromName: string | null
  fromEmail: string | null
  warmupStatus: string | null
  dailyLimit: number | null
  raw: unknown
}

export abstract class SmartleadService {
  private static async request<T>(env: Env, path: string, init?: RequestInit & { query?: Record<string, string | number | undefined> }): Promise<T> {
    if (!env.SMARTLEAD_API_KEY)
      throw new Error('SMARTLEAD_API_KEY is not set — add it to apps/api/.dev.vars (requires a Smartlead plan with API access)')

    const url = new URL(`${BASE_URL}${path}`)
    url.searchParams.set('api_key', env.SMARTLEAD_API_KEY)
    for (const [key, value] of Object.entries(init?.query ?? {})) {
      if (value !== undefined)
        url.searchParams.set(key, String(value))
    }

    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body,
    })

    if (!res.ok)
      throw new Error(`Smartlead error ${res.status}: ${await res.text()}`)

    return res.json<T>()
  }

  static async listCampaigns(env: Env): Promise<Array<SmartleadCampaign>> {
    const data = await this.request<Array<Record<string, unknown>>>(env, '/campaigns/')
    return (data ?? []).map(c => this.mapCampaign(c))
  }

  static async getCampaign(env: Env, id: string): Promise<SmartleadCampaign> {
    const data = await this.request<Record<string, unknown>>(env, `/campaigns/${id}`)
    return this.mapCampaign(data)
  }

  static async getCampaignAnalytics(env: Env, id: string): Promise<SmartleadAnalytics> {
    const data = await this.request<Record<string, unknown>>(env, `/campaigns/${id}/analytics`)
    return {
      campaignName: (data.name as string) ?? null,
      status: (data.status as string) ?? null,
      totalLeads: this.toNumber(data.campaign_lead_stats && (data.campaign_lead_stats as Record<string, unknown>).total) ?? this.toNumber(data.total_count),
      sentCount: this.toNumber(data.sent_count),
      openCount: this.toNumber(data.open_count) ?? this.toNumber(data.unique_open_count),
      clickCount: this.toNumber(data.click_count) ?? this.toNumber(data.unique_click_count),
      replyCount: this.toNumber(data.reply_count),
      bounceCount: this.toNumber(data.bounce_count),
      unsubscribedCount: this.toNumber(data.unsubscribed_count),
      raw: data,
    }
  }

  // Per-lead × per-sequence-step email events — the S5 stats-mirror source.
  // No incremental filter: the API's only date params filter by SENT time (would miss
  // late opens/replies on old sends), and `event_time_gt` is rejected (400, live
  // 2026-07-28). Full pull each time; upserts are idempotent.
  static async getCampaignStatistics(env: Env, id: string, opts?: { offset?: number, limit?: number }): Promise<{ total: number | null, stats: Array<SmartleadLeadStat>, raw: unknown }> {
    const data = await this.request<Record<string, unknown>>(env, `/campaigns/${id}/statistics`, {
      query: { offset: opts?.offset ?? 0, limit: opts?.limit ?? 20 },
    })
    const rows = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : []
    return {
      total: this.toNumber(data.total_stats),
      stats: rows.map(r => ({
        leadEmail: (r.lead_email as string) ?? null,
        leadName: (r.lead_name as string) ?? null,
        sequenceNumber: this.toNumber(r.sequence_number),
        emailSubject: (r.email_subject as string) ?? null,
        sentTime: (r.sent_time as string) ?? null,
        openTime: (r.open_time as string) ?? null,
        openCount: this.toNumber(r.open_count),
        clickTime: (r.click_time as string) ?? null,
        clickCount: this.toNumber(r.click_count),
        replyTime: (r.reply_time as string) ?? null,
        isBounced: Boolean(r.is_bounced),
        raw: r,
      })),
      raw: data,
    }
  }

  static async listCampaignLeads(env: Env, id: string, opts?: { offset?: number, limit?: number }): Promise<{ total: number | null, leads: Array<SmartleadCampaignLead>, raw: unknown }> {
    const data = await this.request<Record<string, unknown>>(env, `/campaigns/${id}/leads`, {
      query: { offset: opts?.offset ?? 0, limit: opts?.limit ?? 20 },
    })
    const rows = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : []
    return {
      total: this.toNumber(data.total_leads),
      leads: rows.map((r) => {
        const lead = (r.lead ?? r) as Record<string, unknown>
        return {
          smartleadLeadId: this.toNumber(lead.id),
          email: (lead.email as string) ?? null,
          firstName: (lead.first_name as string) ?? null,
          lastName: (lead.last_name as string) ?? null,
          companyName: (lead.company_name as string) ?? null,
          status: (r.status as string) ?? null,
          createdAt: (r.created_at as string) ?? (lead.created_at as string) ?? null,
          raw: r,
        }
      }),
      raw: data,
    }
  }

  // Push leads into a campaign. Smartlead dedups by email; max 400 per request
  // (callers chunk — the S3 sync will, the playground sends one at a time).
  static async addLeadsToCampaign(env: Env, id: string, leads: Array<SmartleadPushLead>, settings?: { ignoreDuplicatesInOtherCampaigns?: boolean }): Promise<SmartleadPushResult> {
    if (leads.length === 0 || leads.length > 400)
      throw new Error(`Smartlead accepts 1–400 leads per request (got ${leads.length})`)

    const data = await this.request<Record<string, unknown>>(env, `/campaigns/${id}/leads`, {
      method: 'POST',
      body: JSON.stringify({
        lead_list: leads.map(l => ({
          email: l.email,
          first_name: l.firstName,
          last_name: l.lastName,
          company_name: l.companyName,
          website: l.website,
          phone_number: l.phoneNumber,
          location: l.location,
          linkedin_profile: l.linkedinProfile,
          custom_fields: l.customFields ?? {},
        })),
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: settings?.ignoreDuplicatesInOtherCampaigns ?? false,
        },
      }),
    })

    return {
      addedCount: this.toNumber(data.added_count) ?? this.toNumber(data.upload_count),
      skippedCount: this.toNumber(data.skipped_count) ?? this.toNumber(data.already_added_to_campaign),
      skippedLeads: data.skipped_leads ?? null,
      raw: data,
    }
  }

  // Global lead lookup — needed to get Smartlead's lead id for update calls.
  static async fetchLeadByEmail(env: Env, email: string): Promise<{ smartleadLeadId: number | null, raw: unknown }> {
    const data = await this.request<Record<string, unknown>>(env, '/leads/', { query: { email } })
    return { smartleadLeadId: this.toNumber(data.id), raw: data }
  }

  // Update a lead already in a campaign — used to refresh custom fields
  // (e.g. video_url generated AFTER the lead was pushed). Smartlead requires the
  // email in the body even when only custom_fields change (400 without it).
  static async updateLeadCustomFields(env: Env, campaignId: string, smartleadLeadId: number, email: string, customFields: Record<string, string>): Promise<unknown> {
    return this.request<unknown>(env, `/campaigns/${campaignId}/leads/${smartleadLeadId}`, {
      method: 'POST',
      body: JSON.stringify({ email, custom_fields: customFields }),
    })
  }

  static async listEmailAccounts(env: Env): Promise<Array<SmartleadEmailAccount>> {
    const data = await this.request<unknown>(env, '/email-accounts/', { query: { offset: 0, limit: 100 } })
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : []
    return rows.map(a => ({
      id: this.toNumber(a.id),
      fromName: (a.from_name as string) ?? null,
      fromEmail: (a.from_email as string) ?? null,
      warmupStatus: ((a.warmup_details as Record<string, unknown>)?.status as string) ?? null,
      dailyLimit: this.toNumber(a.message_per_day),
      raw: a,
    }))
  }

  private static mapCampaign(c: Record<string, unknown>): SmartleadCampaign {
    const cron = c.scheduler_cron_value as Record<string, unknown> | null | undefined
    return {
      id: this.toNumber(c.id) ?? 0,
      name: (c.name as string) ?? '',
      status: (c.status as string) ?? 'UNKNOWN',
      createdAt: (c.created_at as string) ?? null,
      maxLeadsPerDay: this.toNumber(c.max_leads_per_day),
      minTimeBtwnEmails: this.toNumber(c.min_time_btwn_emails),
      timezone: (cron?.tz as string) ?? null,
      raw: c,
    }
  }

  private static toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value))
      return value
    if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value)))
      return Number(value)
    return null
  }
}
