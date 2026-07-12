// Jambonz — Konci's own telephony server (demo phone numbers + PINs).
// Base URL: env.JAMBONZ_API_URL · Auth: Authorization: Bearer <JAMBONZ_API_KEY>
// listNumbers/listApplications are standard Jambonz REST (verified live 2026-07-12).
// provisionTrial/releaseNumber are CUSTOM endpoints the old adapter expected — untested,
// and provisioning takes a REAL number from the production pool. See .claude/TELEPHONY.md.

export interface JambonzNumber {
  phoneNumberSid: string
  number: string
  applicationSid: string | null
  voipCarrierSid: string | null
  raw: unknown
}

export interface JambonzApplication {
  applicationSid: string
  name: string
  raw: unknown
}

export interface JambonzTrialResult {
  phone: string
  pin: string
  raw: unknown
}

export abstract class JambonzService {
  private static headers(env: Env) {
    return { 'Authorization': `Bearer ${env.JAMBONZ_API_KEY}`, 'Content-Type': 'application/json' }
  }

  private static baseUrl(env: Env): string {
    return env.JAMBONZ_API_URL.replace(/\/$/, '')
  }

  /** The account's phone number pool. Read-only, free. */
  static async listNumbers(env: Env): Promise<Array<JambonzNumber>> {
    const res = await fetch(`${this.baseUrl(env)}/v1/PhoneNumbers`, { headers: this.headers(env) })
    if (!res.ok)
      throw new Error(`Jambonz phone number list error ${res.status}: ${await res.text()}`)

    const data = await res.json<Array<{ phone_number_sid?: string, number?: string, application_sid?: string, voip_carrier_sid?: string }>>()
    return data.map(n => ({
      phoneNumberSid: n.phone_number_sid ?? '',
      number: n.number ?? '',
      applicationSid: n.application_sid ?? null,
      voipCarrierSid: n.voip_carrier_sid ?? null,
      raw: n,
    }))
  }

  /** The account's applications — the Konci AI agents numbers route to. Read-only, free. */
  static async listApplications(env: Env): Promise<Array<JambonzApplication>> {
    const res = await fetch(`${this.baseUrl(env)}/v1/Accounts/${env.JAMBONZ_ACCOUNT_SID}/Applications`, { headers: this.headers(env) })
    if (!res.ok)
      throw new Error(`Jambonz application list error ${res.status}: ${await res.text()}`)

    const data = await res.json<Array<{ application_sid?: string, name?: string }>>()
    return data.map(a => ({
      applicationSid: a.application_sid ?? '',
      name: a.name ?? '',
      raw: a,
    }))
  }

  /**
   * Provision a trial demo number + PIN (custom endpoint, ported from the old adapter).
   * The PIN is generated here (6 digits) and sent to the server; `reference` is an
   * arbitrary tracking string (old flow passed the workflow-run step id).
   * ⚠️ Allocates a REAL number from the production pool — release it when done.
   */
  static async provisionTrial(env: Env, reference: string, pin?: string): Promise<JambonzTrialResult> {
    const finalPin = pin ?? Math.floor(100000 + Math.random() * 900000).toString()

    const res = await fetch(`${this.baseUrl(env)}/v1/trial/provision`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify({ workflowRunStepId: reference, pin: finalPin }),
    })
    if (!res.ok)
      throw new Error(`Jambonz provision error ${res.status}: ${await res.text()}`)

    const data = await res.json<{ phone?: string }>()
    if (!data.phone)
      throw new Error('Jambonz provision returned no phone number')
    return { phone: data.phone, pin: finalPin, raw: data }
  }

  /** Release a provisioned number back to the pool (custom endpoint, untested). */
  static async releaseNumber(env: Env, phone: string): Promise<void> {
    const res = await fetch(`${this.baseUrl(env)}/v1/trial/release`, {
      method: 'POST',
      headers: this.headers(env),
      body: JSON.stringify({ phone }),
    })
    if (!res.ok)
      throw new Error(`Jambonz release error ${res.status}: ${await res.text()}`)
  }
}
