// Orchestrates Konci test-account registration for leads (KonciService is the HTTP
// adapter). One konci_registrations row per lead tracks the async pipeline; the cron
// registers list members automatically and polls PENDING rows until terminal.
// HARD RULE (owner): a lead is never synced to Smartlead without a PREPARED
// registration + claim URL — the list sync tick enforces it.

import type { KonciRegistrationStatus } from '../generated/prisma/client'
import type { createPrisma } from '../lib/prisma'
import type { KonciLeadResult } from './konci.service'
import { KonciService } from './konci.service'

type PrismaClient = ReturnType<typeof createPrisma>

const RETRYABLE: Array<KonciRegistrationStatus> = ['FAILED', 'NEEDS_PHONE', 'SKIPPED']

function mapStatus(status: string): KonciRegistrationStatus {
  const map: Record<string, KonciRegistrationStatus> = {
    pending: 'PENDING',
    prepared: 'PREPARED',
    needs_phone: 'NEEDS_PHONE',
    failed: 'FAILED',
    skipped: 'SKIPPED',
  }
  return map[status.toLowerCase()] ?? 'PENDING'
}

export abstract class KonciRegistrationService {
  /** Register a lead on the Konci platform (manual action or the cron's auto-register). */
  static async register(prisma: PrismaClient, env: Env, leadId: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { konciRegistration: true, contacts: { orderBy: { priority: 'asc' }, take: 1 } } })
    if (!lead)
      throw new Error('Lead not found')
    if (lead.konciRegistration)
      throw new Error('Lead already has a Konci registration — use retry for failed/needs_phone/skipped')
    if (!lead.website)
      throw new Error('Konci registration requires a website on the lead')

    const contact = lead.contacts[0]
    const socials = lead.socialLinks as Record<string, string> | null
    const result = await KonciService.register(env, {
      businessName: lead.name,
      website: lead.website,
      contactName: contact?.firstName ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : undefined,
      socialMedia: socials ? Object.values(socials)[0] : undefined,
      teamSize: lead.employeeCount ? String(lead.employeeCount) : undefined,
    })

    const registration = await prisma.konciRegistration.create({
      data: {
        leadId,
        konciLeadId: result.konciLeadId,
        status: mapStatus(result.status),
        claimUrl: result.claimUrl,
        claimExpiresAt: result.claimExpiresAt ? new Date(result.claimExpiresAt) : null,
        raw: result.raw as object,
        lastPolledAt: new Date(),
      },
    })
    return registration
  }

  /** Poll Konci once for this registration and persist the result. */
  static async refresh(prisma: PrismaClient, env: Env, leadId: string) {
    const registration = await prisma.konciRegistration.findUnique({ where: { leadId } })
    if (!registration)
      throw new Error('Lead has no Konci registration yet')
    const result = await KonciService.getLead(env, registration.konciLeadId)
    return this.applyResult(prisma, registration.id, result)
  }

  /** Re-run the Konci pipeline — only failed / needs_phone / skipped are retryable. */
  static async retry(prisma: PrismaClient, env: Env, leadId: string) {
    const registration = await prisma.konciRegistration.findUnique({ where: { leadId } })
    if (!registration)
      throw new Error('Lead has no Konci registration yet')
    if (!RETRYABLE.includes(registration.status))
      throw new Error(`Only ${RETRYABLE.join('/')} registrations can be retried (current: ${registration.status})`)
    const result = await KonciService.retry(env, registration.konciLeadId)
    // Retry restarts the pipeline — back to PENDING so the cron resumes polling.
    return this.applyResult(prisma, registration.id, { ...result, status: result.status || 'pending' })
  }

  /** Mint a fresh claim link (old one expired). */
  static async mintClaimLink(prisma: PrismaClient, env: Env, leadId: string) {
    const registration = await prisma.konciRegistration.findUnique({ where: { leadId } })
    if (!registration)
      throw new Error('Lead has no Konci registration yet')
    const result = await KonciService.mintClaimLink(env, registration.konciLeadId)
    return prisma.konciRegistration.update({
      where: { id: registration.id },
      data: {
        claimUrl: result.claimUrl ?? registration.claimUrl,
        claimExpiresAt: result.claimExpiresAt ? new Date(result.claimExpiresAt) : registration.claimExpiresAt,
        raw: result.raw as object,
      },
    })
  }

  private static async applyResult(prisma: PrismaClient, registrationId: string, result: KonciLeadResult) {
    const status = mapStatus(result.status)
    const registration = await prisma.konciRegistration.update({
      where: { id: registrationId },
      data: {
        status,
        claimUrl: result.claimUrl ?? undefined,
        claimExpiresAt: result.claimExpiresAt ? new Date(result.claimExpiresAt) : undefined,
        error: status === 'FAILED' ? this.extractError(result.raw) : null,
        raw: result.raw as object,
        lastPolledAt: new Date(),
      },
    })

    // Konci provisions the demo number/PIN and a business id — lift them onto the
    // lead when present (field names confirmed live 2026-07-23: demo_number,
    // demo_pin, business_id).
    if (status === 'PREPARED') {
      const raw = result.raw as Record<string, unknown>
      const phone = raw.demo_number ?? raw.phone_number ?? raw.phone
      const pin = raw.demo_pin ?? raw.pin
      const businessId = raw.business_id
      if (phone || pin || businessId) {
        await prisma.lead.update({
          where: { id: registration.leadId },
          data: {
            ...(phone ? { demoPhone: String(phone) } : {}),
            ...(pin ? { demoPin: String(pin) } : {}),
            ...(businessId ? { konciCustomerId: String(businessId) } : {}),
          },
        })
      }
    }
    return registration
  }

  private static extractError(raw: unknown): string | null {
    const r = raw as Record<string, unknown>
    return (r?.error as string) ?? (r?.failure_reason as string) ?? (r?.message as string) ?? null
  }

  /**
   * Cron tick 1 — auto-register: every lead that is a member of ANY list must get a
   * Konci account (owner rule: leads are never pushed to Smartlead without one).
   * Small batch per tick; leads without a website can't be registered and are
   * surfaced by the sync tick's eligibility check instead.
   */
  static async runRegisterTick(prisma: PrismaClient, env: Env, limit = 10): Promise<{ registered: number, failed: number }> {
    const leads = await prisma.lead.findMany({
      where: {
        listMembers: { some: {} },
        konciRegistration: null,
        website: { not: null },
      },
      select: { id: true },
      take: limit,
    })
    let registered = 0
    let failed = 0
    for (const lead of leads) {
      try {
        await this.register(prisma, env, lead.id)
        registered++
      }
      catch (err) {
        console.error(`[konci-register] ${lead.id}:`, (err as Error).message)
        failed++
      }
    }
    return { registered, failed }
  }

  /** Cron tick 2 — poll PENDING registrations until Konci's pipeline is terminal. */
  static async runPollTick(prisma: PrismaClient, env: Env, limit = 20): Promise<{ polled: number, prepared: number }> {
    const pending = await prisma.konciRegistration.findMany({
      where: { status: 'PENDING' },
      orderBy: { lastPolledAt: 'asc' },
      take: limit,
    })
    let prepared = 0
    for (const registration of pending) {
      try {
        const result = await KonciService.getLead(env, registration.konciLeadId)
        const updated = await this.applyResult(prisma, registration.id, result)
        if (updated.status === 'PREPARED')
          prepared++
      }
      catch (err) {
        console.error(`[konci-poll] ${registration.konciLeadId}:`, (err as Error).message)
      }
    }
    return { polled: pending.length, prepared }
  }
}
