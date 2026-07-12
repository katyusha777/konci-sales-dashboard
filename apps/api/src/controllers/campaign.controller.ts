import type { CampaignStatus } from '../generated/prisma/client'
import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { CampaignCreateInput, CampaignStats } from '../services/campaign.service'
import { CampaignService } from '../services/campaign.service'

const CAMPAIGN_STATUSES: ReadonlyArray<CampaignStatus> = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']

interface CampaignRow {
  id: string
  name: string
  description: string | null
  status: CampaignStatus
  maxSendsPerHour: number
  maxSendsPerDay: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

function serializeCampaign(c: CampaignRow & { stats: CampaignStats }) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    maxSendsPerHour: c.maxSendsPerHour,
    maxSendsPerDay: c.maxSendsPerDay,
    stats: c.stats,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

type CampaignDetailRow = NonNullable<Awaited<ReturnType<typeof CampaignService.detail>>>

function serializeDetail(c: CampaignDetailRow) {
  return {
    ...serializeCampaign(c),
    steps: c.steps.map(s => ({
      id: s.id,
      campaignId: s.campaignId,
      order: s.order,
      templateId: s.templateId,
      templateName: s.template.name,
      delayDays: s.delayDays,
    })),
    leads: c.leads.map(l => ({
      id: l.id,
      campaignId: l.campaignId,
      leadId: l.leadId,
      leadName: l.lead.name,
      leadStatus: l.lead.status,
      contactEmail: l.contact?.email ?? null,
      status: l.status,
      currentStep: l.currentStep,
      nextSendAt: l.nextSendAt ? l.nextSendAt.toISOString() : null,
      withVideo: l.withVideo,
    })),
  }
}

export default class CampaignController extends Controller {
  private fail(status: 400 | 404, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // GET /api/campaigns
  async index() {
    const campaigns = await CampaignService.list(this.prisma)
    return this.data(campaigns.map(serializeCampaign))
  }

  // GET /api/campaigns/:id
  async show(req: AppRequest<{ Params: { id: string } }>) {
    const detail = await CampaignService.detail(this.prisma, req.params.id)
    if (!detail)
      return this.fail(404, 'Campaign not found')
    return this.data(serializeDetail(detail))
  }

  // PATCH /api/campaigns/:id — { status }
  async setStatus(req: AppRequest<{ Params: { id: string }, Body: { status?: CampaignStatus } }>) {
    const { status } = req.body
    if (!status || !CAMPAIGN_STATUSES.includes(status))
      return this.fail(400, 'A valid status is required')
    try {
      return this.data(serializeCampaign(await CampaignService.setStatus(this.prisma, req.params.id, status)))
    }
    catch {
      return this.fail(404, 'Campaign not found')
    }
  }

  // POST /api/campaigns — create a DRAFT with steps + enrolled leads
  async store(req: AppRequest<{ Body: Partial<CampaignCreateInput> }>) {
    const b = req.body
    if (!b.name?.trim())
      return this.fail(400, 'Campaign name is required')
    if (!b.steps?.length || b.steps.some(s => !s.templateId))
      return this.fail(400, 'At least one step with a template is required')
    if (!b.leadIds?.length)
      return this.fail(400, 'Select at least one lead')

    const { campaign } = await CampaignService.create(this.prisma, {
      name: b.name,
      description: b.description ?? null,
      maxSendsPerHour: b.maxSendsPerHour ?? 20,
      maxSendsPerDay: b.maxSendsPerDay ?? 100,
      steps: b.steps.map(s => ({ templateId: s.templateId, delayDays: s.delayDays ?? 0 })),
      leadIds: b.leadIds,
      videoTopN: b.videoTopN ?? 0,
    }, this.user?.email ?? 'owner')

    const stats = await CampaignService.computeStats(this.prisma, campaign.id)
    return this.data(serializeCampaign({ ...campaign, stats }))
  }
}
