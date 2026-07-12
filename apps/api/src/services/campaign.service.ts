// Campaigns — drip email sequences over selected leads. This service owns creation
// (steps + lead enrollment + best-contact pick + video top-N), the aggregate stats the
// UI shows, and the scheduler's send tick (rate-limited, DB-driven, idempotent).

import type { CampaignStatus } from '../generated/prisma/client'
import type { createPrisma as makePrisma } from '../lib/prisma'
import { isEmailable } from '../lib/emailable'
import { buildLeadVars, renderTemplate } from '../lib/template-render'
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

  static async setStatus(prisma: PrismaClient, id: string, status: CampaignStatus) {
    const campaign = await prisma.campaign.update({ where: { id }, data: { status } })
    return { ...campaign, stats: await this.computeStats(prisma, id) }
  }

  // ── Create (with enrollment) ─────────────────────────────────────────────────────

  static async create(prisma: PrismaClient, input: CampaignCreateInput, createdBy: string) {
    // Resolve each lead's best emailable contact (lowest priority number wins) up front.
    const leads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds } },
      include: { contacts: { orderBy: { priority: 'asc' } } },
    })
    const rankedForVideo = [...leads].sort((a, b) => b.enrichmentScore - a.enrichmentScore)
    const videoLeadIds = new Set(rankedForVideo.slice(0, Math.max(0, input.videoTopN)).map(l => l.id))

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

      let enrolled = 0
      let skipped = 0
      for (const lead of leads) {
        const contact = lead.contacts.find(isEmailable) ?? null
        if (!contact) {
          skipped++ // no emailable contact — don't enroll
          continue
        }
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
        enrolled++
      }

      return { campaign, enrolled, skipped }
    })
  }

  // ── Send tick (cron) ──────────────────────────────────────────────────────────

  static async runSendTick(prisma: PrismaClient, env: Env) {
    const campaigns = await prisma.campaign.findMany({ where: { status: 'ACTIVE' } })
    for (const campaign of campaigns) {
      try {
        await this.sendForCampaign(prisma, env, campaign)
      }
      catch (err) {
        console.error(`[send-tick] campaign ${campaign.id}:`, (err as Error).message)
      }
    }
  }

  private static async sendForCampaign(prisma: PrismaClient, env: Env, campaign: { id: string, maxSendsPerHour: number, maxSendsPerDay: number }) {
    const now = Date.now()
    const inCampaign = { campaignLead: { campaignId: campaign.id } }
    const [sentLastHour, sentToday] = await Promise.all([
      prisma.email.count({ where: { ...inCampaign, sentAt: { gte: new Date(now - 60 * 60 * 1000) } } }),
      prisma.email.count({ where: { ...inCampaign, sentAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } } }),
    ])
    const remaining = Math.min(campaign.maxSendsPerHour - sentLastHour, campaign.maxSendsPerDay - sentToday)
    if (remaining <= 0)
      return

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

    for (const cl of due) {
      try {
        // Suppression guards
        if (cl.lead.status === 'DO_NOT_CONTACT' || !cl.contact || !isEmailable(cl.contact)) {
          await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'SUPPRESSED' } })
          continue
        }
        const step = cl.campaign.steps.find(s => s.order === cl.currentStep)
        if (!step) {
          await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'COMPLETED', nextSendAt: null } })
          continue
        }

        // Create the Email row first so its trackingToken drives the unsubscribe URL.
        const trackingToken = crypto.randomUUID()
        const videoUrl = cl.withVideo ? await this.completedVideoUrl(prisma, env, cl.leadId, step.templateId) : ''
        const vars = buildLeadVars(cl.lead, cl.contact, {
          videoUrl,
          unsubscribeUrl: `${env.APP_URL}/unsubscribe/${trackingToken}`,
        })
        const subject = renderTemplate(step.template.subject, vars)
        const html = renderTemplate(step.template.body, vars)

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

        // Advance the drip: next step's delay, or complete.
        const nextStep = cl.campaign.steps.find(s => s.order === cl.currentStep + 1)
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: nextStep
            ? { status: 'SCHEDULED', currentStep: cl.currentStep + 1, nextSendAt: new Date(Date.now() + nextStep.delayDays * DAY_MS) }
            : { status: 'COMPLETED', nextSendAt: null },
        })
        await prisma.lead.update({ where: { id: cl.leadId }, data: { lastContactedAt: new Date() } })
      }
      catch (err) {
        console.error(`[send-tick] campaignLead ${cl.id}:`, (err as Error).message)
        // leave SCHEDULED for a retry next tick
      }
    }
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
