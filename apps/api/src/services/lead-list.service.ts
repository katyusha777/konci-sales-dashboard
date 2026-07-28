// Lead lists: organize mined leads into named lists, link each list to a Smartlead
// campaign, and sync (push) members once the list is ACTIVE. A DRAFT list never
// sends — build it, make videos, get Konci accounts, THEN activate.
// See .claude/smartlead-integration.md.

import type { createPrisma } from '../lib/prisma'
import { formatPhoneNational, testModeEmail } from '../lib/format'
import { r2PublicUrl } from '../lib/r2'
import type { Contact, KonciRegistration, Lead, LeadStatus, ListStatus, Prisma } from '../generated/prisma/client'
import type { SmartleadLeadStat, SmartleadPushLead } from './smartlead.service'
import { SmartleadService } from './smartlead.service'

type PrismaClient = ReturnType<typeof createPrisma>

/**
 * The address outreach goes to: the AI/manual pick (lead.outreachEmail) wins;
 * fallback: best contact (priority order, usable email), then the lead's own inbox.
 */
export function resolveOutreachEmail(lead: Pick<Lead, 'email' | 'outreachEmail'>, contacts: Array<Pick<Contact, 'email' | 'emailStatus'>>): string | null {
  if (lead.outreachEmail)
    return lead.outreachEmail
  const contact = contacts.find(c => c.email && !['BOUNCED', 'UNSUBSCRIBED', 'COMPLAINED'].includes(c.emailStatus))
  return contact?.email ?? lead.email ?? null
}

export abstract class LeadListService {
  // All lists with member/synced counts — lists are few, no pagination.
  static async list(prisma: PrismaClient) {
    const lists = await prisma.leadList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    })
    const syncedCounts = await prisma.leadListMember.groupBy({
      by: ['listId'],
      where: { syncStatus: 'SYNCED' },
      _count: true,
    })
    // How many members already have a claimable Konci test account (the send gate).
    const konciReadyCounts = await prisma.leadListMember.groupBy({
      by: ['listId'],
      where: { lead: { konciRegistration: { status: 'PREPARED' } } },
      _count: true,
    })
    const syncedByList = new Map(syncedCounts.map(r => [r.listId, r._count]))
    const konciReadyByList = new Map(konciReadyCounts.map(r => [r.listId, r._count]))
    return lists.map(l => ({
      ...l,
      syncedCount: syncedByList.get(l.id) ?? 0,
      konciReadyCount: konciReadyByList.get(l.id) ?? 0,
    }))
  }

  static async detail(prisma: PrismaClient, id: string) {
    const list = await prisma.leadList.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    })
    if (!list)
      return null
    const syncedCount = await prisma.leadListMember.count({ where: { listId: id, syncStatus: 'SYNCED' } })
    const konciReadyCount = await prisma.leadListMember.count({ where: { listId: id, lead: { konciRegistration: { status: 'PREPARED' } } } })
    return { ...list, syncedCount, konciReadyCount }
  }

  // Members paginated (a list can hold thousands of leads).
  static async members(prisma: PrismaClient, listId: string, page: number, perPage: number) {
    const where: Prisma.LeadListMemberWhereInput = { listId }
    const [total, items] = await Promise.all([
      prisma.leadListMember.count({ where }),
      prisma.leadListMember.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { lead: { include: { konciRegistration: true } } },
      }),
    ])
    return { items, total, page, perPage }
  }

  static create(prisma: PrismaClient, data: { name: string, description?: string | null }) {
    return prisma.leadList.create({
      data: { name: data.name.trim(), description: data.description?.trim() || undefined },
      include: { _count: { select: { members: true } } },
    })
  }

  static update(prisma: PrismaClient, id: string, data: { name?: string, description?: string | null, externalCampaignId?: string | null, status?: ListStatus }) {
    return prisma.leadList.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        description: data.description === null ? null : data.description?.trim(),
        // Linking/unlinking the Smartlead campaign sets/clears the provider with it.
        ...(data.externalCampaignId !== undefined && {
          externalCampaignId: data.externalCampaignId,
          provider: data.externalCampaignId ? 'SMARTLEAD' as const : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
    })
  }

  static remove(prisma: PrismaClient, id: string) {
    return prisma.leadList.delete({ where: { id } }) // members cascade
  }

  // Admin nuke: every list; members cascade, leads themselves stay.
  static async removeAll(prisma: PrismaClient): Promise<number> {
    return (await prisma.leadList.deleteMany({})).count
  }

  // Add leads to a list; duplicates are skipped silently (unique [listId, leadId]).
  static async addLeads(prisma: PrismaClient, listId: string, leadIds: Array<string>) {
    const result = await prisma.leadListMember.createMany({
      data: leadIds.map(leadId => ({ listId, leadId })),
      skipDuplicates: true,
    })
    return { added: result.count, duplicates: leadIds.length - result.count }
  }

  static async removeMember(prisma: PrismaClient, listId: string, memberId: string) {
    await prisma.leadListMember.delete({ where: { id: memberId, listId } })
  }

  /**
   * Cron tick — push eligible members of ACTIVE linked lists to their Smartlead
   * campaign. Eligibility (owner rule — leads are NEVER sent without a Konci
   * account): registration PREPARED with a claim URL, and a usable outreach email.
   * Ineligible members stay PENDING with the reason in syncError, so they flow
   * automatically on a later tick once their account/email is ready.
   */
  static async runSyncTick(prisma: PrismaClient, env: Env, batchSize = 100): Promise<{ synced: number, waiting: number, failed: number }> {
    const lists = await prisma.leadList.findMany({
      where: { status: 'ACTIVE', provider: 'SMARTLEAD', externalCampaignId: { not: null } },
    })
    let synced = 0
    let waiting = 0
    let failed = 0

    for (const list of lists) {
      const members = await prisma.leadListMember.findMany({
        where: { listId: list.id, syncStatus: 'PENDING' },
        include: {
          lead: { include: { contacts: { orderBy: { priority: 'asc' } }, konciRegistration: true } },
        },
        take: batchSize,
      })
      if (members.length === 0)
        continue

      const eligible: Array<{ memberId: string, push: SmartleadPushLead }> = []
      for (const member of members) {
        const blocker = this.syncBlocker(member.lead, member.lead.konciRegistration)
        if (blocker) {
          waiting++
          if (member.syncError !== blocker)
            await prisma.leadListMember.update({ where: { id: member.id }, data: { syncError: blocker } })
          continue
        }
        eligible.push({ memberId: member.id, push: this.buildPushLead(env, member.lead, member.lead.konciRegistration!) })
      }
      if (eligible.length === 0)
        continue

      try {
        await SmartleadService.addLeadsToCampaign(env, list.externalCampaignId!, eligible.map(e => e.push))
        await prisma.leadListMember.updateMany({
          where: { id: { in: eligible.map(e => e.memberId) } },
          data: { syncStatus: 'SYNCED', syncedAt: new Date(), syncError: null },
        })
        await prisma.leadList.update({ where: { id: list.id }, data: { lastSyncedAt: new Date() } })
        // Smartlead dedups by email, so a re-pushed lead is a no-op there.
        synced += eligible.length
      }
      catch (err) {
        await prisma.leadListMember.updateMany({
          where: { id: { in: eligible.map(e => e.memberId) } },
          data: { syncStatus: 'FAILED', syncError: (err as Error).message },
        })
        failed += eligible.length
      }
    }
    return { synced, waiting, failed }
  }

  /**
   * Force re-push member(s) to the linked Smartlead campaign — explicit owner action
   * from the list page. Already-SYNCED leads get their custom fields UPDATED in place
   * (Smartlead's add API silently skips duplicates, so re-adding wouldn't refresh
   * video_url/demo/claim fields); everything else goes through the normal add path,
   * which only runs when the list is ACTIVE (the send gate stays intact).
   */
  static async resyncMembers(prisma: PrismaClient, env: Env, listId: string, memberIds?: Array<string>): Promise<{ updated: number, added: number, waiting: number, failed: number }> {
    const list = await prisma.leadList.findUnique({ where: { id: listId } })
    if (!list || list.provider !== 'SMARTLEAD' || !list.externalCampaignId)
      throw new Error('Link the list to a Smartlead campaign first')

    const members = await prisma.leadListMember.findMany({
      where: { listId, ...(memberIds ? { id: { in: memberIds } } : {}) },
      include: {
        lead: { include: { contacts: { orderBy: { priority: 'asc' } }, konciRegistration: true } },
      },
    })

    let updated = 0
    let added = 0
    let waiting = 0
    let failed = 0
    for (const member of members) {
      // Stored video links rot when APP_URL / VIDEOS_PUBLIC_URL change — refresh them
      // from the newest completed render before pushing.
      await this.restampVideoUrls(prisma, env, member.lead)
      const blocker = this.syncBlocker(member.lead, member.lead.konciRegistration)
      if (blocker) {
        waiting++
        await prisma.leadListMember.update({ where: { id: member.id }, data: { syncStatus: 'PENDING', syncError: blocker } })
        continue
      }
      const push = this.buildPushLead(env, member.lead, member.lead.konciRegistration!)
      try {
        // Presence in Smartlead decides update-vs-add (NOT our local syncStatus — a
        // FAILED member can already be in the campaign, and adds dedup-skip silently
        // without refreshing fields).
        // ponytail: one Smartlead lookup+call per member (lists are small); batch when they aren't
        const { smartleadLeadId } = await SmartleadService.fetchLeadByEmail(env, push.email)
        if (smartleadLeadId) {
          await SmartleadService.updateLeadCustomFields(env, list.externalCampaignId, smartleadLeadId, push.email, push.customFields!)
          updated++
        }
        else if (list.status === 'ACTIVE') {
          await SmartleadService.addLeadsToCampaign(env, list.externalCampaignId, [push])
          added++
        }
        else {
          waiting++
          await prisma.leadListMember.update({ where: { id: member.id }, data: { syncStatus: 'PENDING', syncError: 'not in Smartlead yet — pushes when the list is ACTIVE' } })
          continue
        }
        await prisma.leadListMember.update({ where: { id: member.id }, data: { syncStatus: 'SYNCED', syncedAt: new Date(), syncError: null } })
      }
      catch (err) {
        failed++
        await prisma.leadListMember.update({ where: { id: member.id }, data: { syncStatus: 'FAILED', syncError: (err as Error).message } })
      }
    }
    if (updated || added)
      await prisma.leadList.update({ where: { id: listId }, data: { lastSyncedAt: new Date() } })
    return { updated, added, waiting, failed }
  }

  /**
   * Re-stamp the lead's video links from its newest COMPLETED render using the CURRENT
   * env (APP_URL / VIDEOS_PUBLIC_URL) — mutates the passed lead so callers push fresh URLs.
   */
  private static async restampVideoUrls(prisma: PrismaClient, env: Env, lead: Lead): Promise<void> {
    const video = await prisma.video.findFirst({
      where: { leadId: lead.id, status: 'COMPLETED', r2Key: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
    if (!video)
      return
    const videoUrl = `${env.APP_URL}/v/${video.token}`
    const videoThumbnailUrl = r2PublicUrl(env, video.thumbnailR2Key)
      ?? (video.thumbnailR2Key ? `${env.APP_URL}/api/v/${video.token}/thumb` : null)
    if (videoUrl !== lead.videoUrl || videoThumbnailUrl !== lead.videoThumbnailUrl) {
      await prisma.lead.update({ where: { id: lead.id }, data: { videoUrl, videoThumbnailUrl } })
      lead.videoUrl = videoUrl
      lead.videoThumbnailUrl = videoThumbnailUrl
    }
  }

  /** Why a member can't be pushed yet — null means eligible. */
  private static syncBlocker(lead: Lead & { contacts: Array<Contact> }, registration: KonciRegistration | null): string | null {
    if (!registration)
      return lead.website ? 'waiting for Konci registration' : 'no website — Konci registration impossible'
    if (registration.status === 'PENDING')
      return 'Konci registration still running'
    if (registration.status !== 'PREPARED' || !registration.claimUrl)
      return `Konci registration ${registration.status} — retry it from the lead page`
    if (!resolveOutreachEmail(lead, lead.contacts))
      return 'no usable email on lead or contacts'
    return null
  }

  private static buildPushLead(env: Env, lead: Lead & { contacts: Array<Contact> }, registration: KonciRegistration): SmartleadPushLead {
    const realEmail = resolveOutreachEmail(lead, lead.contacts)!
    const contact = lead.contacts.find(c => c.email === realEmail)
    // EMAIL_TEST_MODE (plan §6): never push a real address — redirect to the
    // @katyusha.app catch-all, named after the company so test sends are identifiable.
    const email = env.EMAIL_TEST_MODE === 'true' ? testModeEmail(lead.name) : realEmail
    return {
      email,
      firstName: contact?.firstName ?? undefined,
      lastName: contact?.lastName ?? undefined,
      companyName: lead.name,
      website: lead.website ?? undefined,
      phoneNumber: lead.phone ?? undefined,
      location: [lead.city, lead.state].filter(Boolean).join(', ') || undefined,
      customFields: {
        business_name: lead.name,
        industry: lead.industry ?? '',
        city: lead.city ?? '',
        video_url: lead.videoUrl ?? '',
        video_thumbnail: lead.videoThumbnailUrl ?? '',
        demo_phone: formatPhoneNational(lead.demoPhone), // "(949) 216-4643" — reads better in emails
        demo_phone_e164: lead.demoPhone ?? '', // raw "+1…" for tel: links (dialable, PIN appendable)
        demo_pin: lead.demoPin ?? '',
        claim_url: registration.claimUrl ?? '',
      },
    }
  }

  /**
   * Cron tick — S5 stats mirror. Pulls per-lead × per-step email events from every
   * linked campaign (throttled per list), upserts provider_email_stats, matches rows
   * to leads by email, and moves lead statuses along the funnel
   * (sent → CONTACTED, open/click → ENGAGED, reply → REPLIED, bounce → contact BOUNCED).
   */
  static async runStatsPullTick(prisma: PrismaClient, env: Env, minIntervalMs = 30 * 60 * 1000): Promise<{ listsPulled: number, statsUpserted: number }> {
    const lists = await prisma.leadList.findMany({
      where: { provider: 'SMARTLEAD', externalCampaignId: { not: null } },
    })
    let listsPulled = 0
    let statsUpserted = 0

    for (const list of lists) {
      if (list.statsPulledAt && Date.now() - list.statsPulledAt.getTime() < minIntervalMs)
        continue
      try {
        let offset = 0
        const limit = 100
        // Full pull each time (their event-time filter is rejected; see
        // SmartleadService.getCampaignStatistics). Hard cap per tick keeps a huge
        // campaign from eating the Worker.
        // ponytail: campaigns >2000 stat rows only mirror the first 2000 per tick —
        // add real pagination-cursor state if lists ever get that big.
        while (offset < 2000) {
          const page = await SmartleadService.getCampaignStatistics(env, list.externalCampaignId!, { offset, limit })
          for (const stat of page.stats) {
            if (await this.upsertStat(prisma, list.externalCampaignId!, stat))
              statsUpserted++
          }
          if (page.stats.length < limit)
            break
          offset += limit
        }
        await prisma.leadList.update({ where: { id: list.id }, data: { statsPulledAt: new Date() } })
        listsPulled++
      }
      catch (err) {
        console.error(`[stats-pull] list ${list.id}:`, (err as Error).message)
      }
    }
    return { listsPulled, statsUpserted }
  }

  private static async upsertStat(prisma: PrismaClient, externalCampaignId: string, stat: SmartleadLeadStat): Promise<boolean> {
    if (!stat.leadEmail || stat.sequenceNumber === null)
      return false
    const email = stat.leadEmail.toLowerCase()
    // Insensitive: contact/outreach emails aren't lowercased on every write path.
    const emailMatch = { equals: email, mode: 'insensitive' as const }
    let lead = await prisma.lead.findFirst({
      where: { OR: [{ outreachEmail: emailMatch }, { email: emailMatch }, { contacts: { some: { email: emailMatch } } }] },
      select: { id: true, status: true, lastContactedAt: true, lastEngagedAt: true },
    })
    // EMAIL_TEST_MODE pushes leads as "<companyname>@katyusha.app" — no lead field
    // carries that address, so match the name-slug back to the lead.
    if (!lead && email.endsWith('@katyusha.app')) {
      const slug = email.split('@')[0]!
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM leads
        WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = ${slug}
        LIMIT 1`
      if (rows[0]) {
        lead = await prisma.lead.findUnique({
          where: { id: rows[0].id },
          select: { id: true, status: true, lastContactedAt: true, lastEngagedAt: true },
        })
      }
    }

    const parse = (v: string | null) => v ? new Date(v) : null
    const sentAt = parse(stat.sentTime)
    const repliedAt = parse(stat.replyTime)
    const engagedAt = parse(stat.clickTime) ?? parse(stat.openTime)

    const data = {
      leadId: lead?.id ?? null,
      sentAt,
      openCount: stat.openCount ?? 0,
      clickCount: stat.clickCount ?? 0,
      repliedAt,
      bounced: stat.isBounced,
      raw: stat.raw as object,
      pulledAt: new Date(),
    }
    await prisma.providerEmailStat.upsert({
      where: {
        provider_externalCampaignId_externalLeadEmail_sequenceNumber: {
          provider: 'SMARTLEAD',
          externalCampaignId,
          externalLeadEmail: email,
          sequenceNumber: stat.sequenceNumber,
        },
      },
      create: { provider: 'SMARTLEAD', externalCampaignId, externalLeadEmail: email, sequenceNumber: stat.sequenceNumber, ...data },
      update: data,
    })

    if (lead) {
      // Funnel: only ever move FORWARD; never touch closed / do-not-contact leads.
      const untouchable: Array<LeadStatus> = ['CLOSED_WON', 'CLOSED_LOST', 'DO_NOT_CONTACT']
      if (!untouchable.includes(lead.status)) {
        const rank: Partial<Record<LeadStatus, number>> = { CONTACTED: 1, ENGAGED: 2, REPLIED: 3 }
        const current = rank[lead.status] ?? 0
        let next: LeadStatus | null = null
        if (repliedAt && current < 3)
          next = 'REPLIED'
        else if (engagedAt && current < 2)
          next = 'ENGAGED'
        else if (sentAt && current < 1)
          next = 'CONTACTED'
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            ...(next ? { status: next } : {}),
            ...(sentAt && (!lead.lastContactedAt || sentAt > lead.lastContactedAt) ? { lastContactedAt: sentAt } : {}),
            ...(engagedAt && (!lead.lastEngagedAt || engagedAt > lead.lastEngagedAt) ? { lastEngagedAt: engagedAt } : {}),
          },
        })
      }
      if (stat.isBounced)
        await prisma.contact.updateMany({ where: { leadId: lead.id, email: { equals: email, mode: 'insensitive' } }, data: { emailStatus: 'BOUNCED' } })
    }
    return true
  }

  /**
   * A video finished AFTER the lead was already pushed — refresh video_url /
   * video_thumbnail on the Smartlead lead in every campaign it was synced to.
   * Best-effort: failures log and the stats/claim flow is unaffected.
   */
  static async pushVideoFieldsUpdate(prisma: PrismaClient, env: Env, leadId: string): Promise<void> {
    const members = await prisma.leadListMember.findMany({
      where: { leadId, syncStatus: 'SYNCED' },
      include: { list: true, lead: { include: { contacts: { orderBy: { priority: 'asc' } } } } },
    })
    const synced = members.filter(m => m.list.provider === 'SMARTLEAD' && m.list.externalCampaignId)
    if (synced.length === 0)
      return
    const lead = synced[0]!.lead
    const email = resolveOutreachEmail(lead, lead.contacts)
    if (!email)
      return
    const { smartleadLeadId } = await SmartleadService.fetchLeadByEmail(env, email)
    if (!smartleadLeadId)
      return
    for (const member of synced) {
      await SmartleadService.updateLeadCustomFields(env, member.list.externalCampaignId!, smartleadLeadId, email, {
        video_url: lead.videoUrl ?? '',
        video_thumbnail: lead.videoThumbnailUrl ?? '',
      }).catch(err => console.error(`[video-fields-update] ${member.list.externalCampaignId}:`, (err as Error).message))
    }
  }
}
