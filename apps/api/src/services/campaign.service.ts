// Campaigns — drip email sequences over selected leads. This service owns creation
// (steps + lead enrollment + best-contact pick + video top-N), the aggregate stats the
// UI shows, and the scheduler's send tick (rate-limited, DB-driven, idempotent).

import type { CampaignStatus } from '../generated/prisma/client'
import type { createPrisma as makePrisma } from '../lib/prisma'
import { isEmailable } from '../lib/emailable'
import { buildLeadVars, renderBody, renderTemplate } from '../lib/template-render'
import { EmailService } from './email.service'

type PrismaClient = ReturnType<typeof makePrisma>

export interface CampaignCreateInput {
  name: string
  description?: string | null
  maxSendsPerHour: number
  maxSendsPerDay: number
  steps: Array<{ templateId: string, delayDays: number }>
  leadIds: Array<string>
  videoTopN: number
}

export interface CampaignStats {
  leads: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
}

const DAY_MS = 86_400_000

export abstract class CampaignService {
  // ── Reads ──────────────────────────────────────────────────────────────────────

  static async computeStats(prisma: PrismaClient, campaignId: string): Promise<CampaignStats> {
    const inCampaign = { campaignLead: { campaignId } }
    const [leads, sent, delivered, opened, clicked, replied] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId } }),
      prisma.email.count({ where: { ...inCampaign, sentAt: { not: null } } }),
      prisma.email.count({ where: { ...inCampaign, events: { some: { type: 'DELIVERED' } } } }),
      prisma.email.count({ where: { ...inCampaign, events: { some: { type: 'OPENED' } } } }),
      prisma.email.count({ where: { ...inCampaign, events: { some: { type: 'CLICKED' } } } }),
      prisma.campaignLead.count({ where: { campaignId, status: 'REPLIED' } }),
    ])
    return { leads, sent, delivered, opened, clicked, replied }
  }

  static async list(prisma: PrismaClient) {
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } })
    return Promise.all(campaigns.map(async c => ({ ...c, stats: await this.computeStats(prisma, c.id) })))
  }

  static async detail(prisma: PrismaClient, id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' }, include: { template: { select: { name: true } } } },
        leads: {
          orderBy: { createdAt: 'asc' },
          include: {
            lead: { select: { name: true, status: true } },
            contact: { select: { email: true } },
          },
        },
      },
    })
    if (!campaign)
      return null
    return { ...campaign, stats: await this.computeStats(prisma, id) }
  }

  // ── Create (with enrollment) ─────────────────────────────────────────────────────

  static async create(prisma: PrismaClient, input: CampaignCreateInput, createdBy: string) {
    // Resolve each lead's best emailable contact (lowest priority number wins) up front.
    const leads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds } },
      include: { contacts: { orderBy: { priority: 'asc' } } },
    })
    // Only leads with an emailable contact actually enroll — pick each one's contact now,
    // and choose the withVideo top-N from THOSE (so an excluded lead can't waste a video slot).
    const enrollable = leads
      .map(lead => ({ lead, contact: lead.contacts.find(isEmailable) ?? null }))
      .filter((e): e is { lead: typeof e.lead, contact: NonNullable<typeof e.contact> } => e.contact !== null)
    const videoLeadIds = new Set(
      [...enrollable]
        .sort((a, b) => b.lead.enrichmentScore - a.lead.enrichmentScore)
        .slice(0, Math.max(0, input.videoTopN))
        .map(e => e.lead.id),
    )
    const skipped = leads.length - enrollable.length

    return prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          maxSendsPerHour: input.maxSendsPerHour,
          maxSendsPerDay: input.maxSendsPerDay,
          status: 'DRAFT',
          createdBy,
        },
      })

      await tx.campaignStep.createMany({
        data: input.steps.map((s, i) => ({
          campaignId: campaign.id,
          order: i,
          templateId: s.templateId,
          delayDays: i === 0 ? 0 : s.delayDays,
        })),
      })

      for (const { lead, contact } of enrollable) {
        await tx.campaignLead.create({
          data: {
            campaignId: campaign.id,
            leadId: lead.id,
            contactId: contact.id,
            status: 'SCHEDULED',
            currentStep: 0,
            nextSendAt: new Date(), // due immediately; actual sending is gated by campaign status
            withVideo: videoLeadIds.has(lead.id),
          },
        })
      }

      return { campaign, enrolled: enrollable.length, skipped }
    })
  }

  // ── Send tick (cron) ──────────────────────────────────────────────────────────

  static async runSendTick(prisma: PrismaClient, env: Env): Promise<{ sent: number }> {
    const campaigns = await prisma.campaign.findMany({ where: { status: 'ACTIVE' } })
    let sent = 0
    for (const campaign of campaigns) {
      try {
        sent += await this.sendForCampaign(prisma, env, campaign)
      }
      catch (err) {
        console.error(`[send-tick] campaign ${campaign.id}:`, (err as Error).message)
      }
    }
    return { sent }
  }

  private static async sendForCampaign(prisma: PrismaClient, env: Env, campaign: { id: string, maxSendsPerHour: number, maxSendsPerDay: number }): Promise<number> {
    const now = Date.now()
    const inCampaign = { campaignLead: { campaignId: campaign.id } }
    const [sentLastHour, sentToday] = await Promise.all([
      prisma.email.count({ where: { ...inCampaign, sentAt: { gte: new Date(now - 60 * 60 * 1000) } } }),
      prisma.email.count({ where: { ...inCampaign, sentAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } } }),
    ])
    const remaining = Math.min(campaign.maxSendsPerHour - sentLastHour, campaign.maxSendsPerDay - sentToday)
    if (remaining <= 0)
      return 0

    const due = await prisma.campaignLead.findMany({
      where: { campaignId: campaign.id, status: { in: ['PENDING', 'SCHEDULED'] }, nextSendAt: { lte: new Date() } },
      orderBy: { nextSendAt: 'asc' },
      take: remaining,
      include: {
        lead: true,
        contact: true,
        campaign: { include: { steps: { orderBy: { order: 'asc' }, include: { template: true } } } },
      },
    })

    let sent = 0
    for (const cl of due) {
      if (await this.sendOne(prisma, env, cl) === 'sent')
        sent++
    }
    return sent
  }

  /**
   * The scheduler's per-lead send: send the current step, then advance the drip (next step
   * or COMPLETED). Returns what happened.
   */
  static async sendOne(prisma: PrismaClient, env: Env, cl: CampaignLeadForSend): Promise<'sent' | 'suppressed' | 'completed' | 'failed'> {
    if (cl.lead.status === 'DO_NOT_CONTACT' || !cl.contact || !isEmailable(cl.contact)) {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'SUPPRESSED' } })
      return 'suppressed'
    }
    const step = cl.campaign.steps.find(s => s.order === cl.currentStep)
    if (!step) {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'COMPLETED', nextSendAt: null } })
      return 'completed'
    }

    const result = await this.deliver(prisma, env, cl, step)
    if (result !== 'sent')
      return result

    // Advance the drip: next step's delay, or complete.
    const nextStep = cl.campaign.steps.find(s => s.order === cl.currentStep + 1)
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: nextStep
        ? { status: 'SCHEDULED', currentStep: cl.currentStep + 1, nextSendAt: new Date(Date.now() + nextStep.delayDays * DAY_MS) }
        : { status: 'COMPLETED', nextSendAt: null },
    })
    return result
  }

  /** Render + send + record one email for a lead's step. Does NOT touch the drip state. */
  private static async deliver(prisma: PrismaClient, env: Env, cl: CampaignLeadForSend, step: CampaignLeadForSend['campaign']['steps'][number]): Promise<'sent' | 'failed'> {
    if (!cl.contact)
      return 'failed'
    try {
      // Create the Email row first so its trackingToken drives the unsubscribe URL.
      const trackingToken = crypto.randomUUID()
      const videoUrl = cl.withVideo ? await this.completedVideoUrl(prisma, env, cl.leadId, step.templateId) : ''
      const vars = buildLeadVars(cl.lead, cl.contact, {
        videoUrl,
        unsubscribeUrl: `${env.APP_URL}/unsubscribe/${trackingToken}`,
      })
      const subject = renderTemplate(step.template.subject, vars)
      const html = renderBody(step.template.body, vars) // preserves authored line breaks

      const email = await prisma.email.create({
        data: {
          campaignLeadId: cl.id,
          leadId: cl.leadId,
          contactId: cl.contactId,
          templateId: step.templateId,
          subject,
          trackingToken,
          status: 'PENDING',
          wasTestMode: EmailService.isTestMode(env),
        },
      })

      const result = await EmailService.send(env, {
        to: cl.contact.email!,
        subject,
        html,
        headers: EmailService.buildListUnsubscribeHeaders(env, trackingToken),
      })

      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'SENT', providerMessageId: result.id, sentAt: new Date() },
      })
      await prisma.lead.update({ where: { id: cl.leadId }, data: { lastContactedAt: new Date() } })
      return 'sent'
    }
    catch (err) {
      console.error(`[send] campaignLead ${cl.id}:`, (err as Error).message)
      return 'failed'
    }
  }

  /**
   * Per-lead "Send now" (manual, for testing): send this lead an email immediately,
   * ignoring the schedule and campaign status. An in-progress lead sends its current step
   * and advances; an already-COMPLETED lead re-sends its last step WITHOUT changing state,
   * so you can test-send to it repeatedly. A suppressed contact (bounced/unsubscribed) is
   * still refused.
   */
  static async sendLeadNow(prisma: PrismaClient, env: Env, campaignId: string, campaignLeadId: string): Promise<'sent' | 'suppressed' | 'completed' | 'failed'> {
    const cl = await prisma.campaignLead.findFirst({
      where: { id: campaignLeadId, campaignId },
      include: {
        lead: true,
        contact: true,
        campaign: { include: { steps: { orderBy: { order: 'asc' }, include: { template: true } } } },
      },
    })
    if (!cl)
      throw new Error('Campaign lead not found')

    if (cl.lead.status === 'DO_NOT_CONTACT' || !cl.contact || !isEmailable(cl.contact))
      return 'suppressed'

    // Already done → re-send the last step as a pure test resend (no state change).
    if (cl.status === 'COMPLETED' || cl.status === 'REPLIED') {
      const lastStep = cl.campaign.steps.at(-1)
      if (!lastStep)
        throw new Error('Campaign has no steps to send')
      return this.deliver(prisma, env, cl, lastStep)
    }
    // Otherwise a real send that advances the drip.
    return this.sendOne(prisma, env, cl)
  }

  /** Edit a campaign's settings (any subset). */
  static async update(prisma: PrismaClient, id: string, fields: { name?: string, description?: string | null, maxSendsPerHour?: number, maxSendsPerDay?: number, status?: CampaignStatus }) {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.maxSendsPerHour !== undefined && { maxSendsPerHour: fields.maxSendsPerHour }),
        ...(fields.maxSendsPerDay !== undefined && { maxSendsPerDay: fields.maxSendsPerDay }),
        ...(fields.status !== undefined && { status: fields.status }),
      },
    })
    return { ...campaign, stats: await this.computeStats(prisma, id) }
  }

  /** The lead's completed video URL for this template, if one exists (send stays decoupled from rendering). */
  private static async completedVideoUrl(prisma: PrismaClient, env: Env, leadId: string, templateId: string): Promise<string> {
    const video = await prisma.video.findFirst({
      where: { leadId, templateId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    })
    return video ? `${env.APP_URL}/v/${video.token}` : ''
  }
}

// The campaign-lead shape sendOne needs: lead + contact + campaign steps (with templates).
function loadCampaignLeadForSend(prisma: PrismaClient, id: string) {
  return prisma.campaignLead.findFirst({
    where: { id },
    include: {
      lead: true,
      contact: true,
      campaign: { include: { steps: { orderBy: { order: 'asc' }, include: { template: true } } } },
    },
  })
}
type CampaignLeadForSend = NonNullable<Awaited<ReturnType<typeof loadCampaignLeadForSend>>>
