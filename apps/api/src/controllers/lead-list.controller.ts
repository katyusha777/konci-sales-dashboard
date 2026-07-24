import type { KonciRegistration, Lead, LeadList, LeadListMember, ListStatus } from '../generated/prisma/client'
import type { ApiResponse, AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import { LeadListService } from '../services/lead-list.service'
import type { SmartleadCampaign } from '../services/smartlead.service'
import { SmartleadService } from '../services/smartlead.service'

// ── Wire serializers — shapes mirror the frontend ILeadList* types ─────────────

const iso = (d: Date | null) => d ? d.toISOString() : null

function serializeList(list: LeadList & { _count?: { members: number }, syncedCount?: number, konciReadyCount?: number }) {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    status: list.status,
    provider: list.provider,
    externalCampaignId: list.externalCampaignId,
    lastSyncedAt: iso(list.lastSyncedAt),
    memberCount: list._count?.members ?? 0,
    syncedCount: list.syncedCount ?? 0,
    konciReadyCount: list.konciReadyCount ?? 0,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }
}

function serializeMember(m: LeadListMember & { lead: Lead & { konciRegistration: KonciRegistration | null } }) {
  return {
    id: m.id,
    leadId: m.leadId,
    syncStatus: m.syncStatus,
    syncedAt: iso(m.syncedAt),
    syncError: m.syncError,
    createdAt: m.createdAt.toISOString(),
    lead: {
      id: m.lead.id,
      name: m.lead.name,
      domain: m.lead.domain,
      email: m.lead.email,
      city: m.lead.city,
      state: m.lead.state,
      industry: m.lead.industry,
      status: m.lead.status,
      enrichmentStatus: m.lead.enrichmentStatus,
      enrichmentScore: m.lead.enrichmentScore,
      // Konci demo + outreach-video readiness (the two send gates)
      demoPhone: m.lead.demoPhone,
      demoPin: m.lead.demoPin,
      videoUrl: m.lead.videoUrl,
      konciStatus: m.lead.konciRegistration?.status ?? null,
      konciClaimUrl: m.lead.konciRegistration?.claimUrl ?? null,
    },
  }
}

type SerializedList = ReturnType<typeof serializeList>
type SerializedMember = ReturnType<typeof serializeMember>

// ── Controller ──────────────────────────────────────────────────────────────────

export default class LeadListController extends Controller {
  async index(): Promise<ApiResponse<Array<SerializedList>>> {
    const lists = await LeadListService.list(this.prisma)
    return this.data(lists.map(serializeList))
  }

  async show(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<SerializedList>> {
    const list = await LeadListService.detail(this.prisma, req.params.id)
    if (!list)
      return this.error('List not found')
    return this.data(serializeList(list))
  }

  async members(req: AppRequest<{ Params: { id: string }, Query: { page?: string, perPage?: string } }>): Promise<ApiResponse<{ items: Array<SerializedMember>, total: number, page: number, perPage: number }>> {
    const page = Math.max(1, Number(req.query.page) || 1)
    const perPage = Math.min(200, Math.max(1, Number(req.query.perPage) || 25))
    const result = await LeadListService.members(this.prisma, req.params.id, page, perPage)
    return this.data({ ...result, items: result.items.map(serializeMember) })
  }

  async store(req: AppRequest<{ Body: { name?: string, description?: string } }>): Promise<ApiResponse<SerializedList>> {
    if (!req.body.name?.trim())
      return this.error('name is required')
    const list = await LeadListService.create(this.prisma, { name: req.body.name, description: req.body.description })
    return this.data(serializeList(list))
  }

  async update(req: AppRequest<{ Params: { id: string }, Body: { name?: string, description?: string | null, externalCampaignId?: string | null, status?: ListStatus } }>): Promise<ApiResponse<SerializedList>> {
    if (req.body.name !== undefined && !req.body.name.trim())
      return this.error('name cannot be empty')
    if (req.body.status !== undefined && !['DRAFT', 'ACTIVE', 'PAUSED'].includes(req.body.status))
      return this.error('status must be DRAFT, ACTIVE or PAUSED')
    // Activation gate: an ACTIVE list starts pushing to Smartlead on the next cron
    // tick, so it must be linked to a campaign first.
    if (req.body.status === 'ACTIVE') {
      const current = await LeadListService.detail(this.prisma, req.params.id)
      const linkedAfterUpdate = req.body.externalCampaignId !== undefined ? !!req.body.externalCampaignId : !!current?.externalCampaignId
      if (!linkedAfterUpdate)
        return this.error('Link the list to a Smartlead campaign before activating')
    }
    const list = await LeadListService.update(this.prisma, req.params.id, req.body)
    return this.data(serializeList(list))
  }

  // GET /api/lists/smartlead-campaigns — live campaign list for the link picker
  async smartleadCampaigns(): Promise<ApiResponse<Array<SmartleadCampaign>>> {
    try {
      return this.data(await SmartleadService.listCampaigns(this.c.env))
    }
    catch (err) {
      return this.error('Smartlead campaign list failed', (err as Error).message)
    }
  }

  async destroy(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse> {
    await LeadListService.remove(this.prisma, req.params.id)
    return this.success('List deleted')
  }

  // POST /api/lists/:id/resync — force re-push EVERY member (synced ones get field updates)
  async resync(req: AppRequest<{ Params: { id: string } }>): Promise<ApiResponse<{ updated: number, added: number, waiting: number, failed: number }>> {
    try {
      return this.data(await LeadListService.resyncMembers(this.prisma, this.c.env, req.params.id))
    }
    catch (err) {
      return this.error('Resync failed', (err as Error).message)
    }
  }

  // POST /api/lists/:id/members/:memberId/resync — force re-push one member
  async resyncMember(req: AppRequest<{ Params: { id: string, memberId: string } }>): Promise<ApiResponse<{ updated: number, added: number, waiting: number, failed: number }>> {
    try {
      return this.data(await LeadListService.resyncMembers(this.prisma, this.c.env, req.params.id, [req.params.memberId]))
    }
    catch (err) {
      return this.error('Resync failed', (err as Error).message)
    }
  }

  async addLeads(req: AppRequest<{ Params: { id: string }, Body: { leadIds?: Array<string> } }>): Promise<ApiResponse<{ added: number, duplicates: number }>> {
    if (!Array.isArray(req.body.leadIds) || req.body.leadIds.length === 0)
      return this.error('leadIds array is required')
    return this.data(await LeadListService.addLeads(this.prisma, req.params.id, req.body.leadIds))
  }

  async removeMember(req: AppRequest<{ Params: { id: string, memberId: string } }>): Promise<ApiResponse> {
    await LeadListService.removeMember(this.prisma, req.params.id, req.params.memberId)
    return this.success('Removed from list')
  }
}
