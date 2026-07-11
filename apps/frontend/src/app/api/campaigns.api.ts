import type { ICampaign, ICampaignDetail } from '~/app/types'
import { dummyCampaignDetails, dummyCampaigns } from '~/app/dummy-data/campaigns'
import { dummy } from './client'

// DUMMY-BACKED (frontend-first phase).
export abstract class CampaignsApi {
  static list(): Promise<Array<ICampaign>> {
    return dummy(dummyCampaigns)
  }

  static async get(id: string): Promise<ICampaignDetail> {
    const detail = dummyCampaignDetails[id]
      ?? { ...dummyCampaigns.find(c => c.id === id)!, steps: [], leads: [] }
    return dummy(detail)
  }

  static async setStatus(id: string, status: ICampaign['status']): Promise<ICampaign> {
    const campaign = dummyCampaigns.find(c => c.id === id)
    if (campaign)
      campaign.status = status
    return dummy(campaign!, 200)
  }

  static async create(input: { name: string, description: string, maxSendsPerHour: number, maxSendsPerDay: number }): Promise<ICampaign> {
    const campaign: ICampaign = {
      id: `cmp_${Date.now()}`,
      status: 'DRAFT',
      stats: { leads: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 },
      createdBy: useAuth().user.value?.email ?? 'me',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input,
    }
    dummyCampaigns.unshift(campaign)
    return dummy(campaign, 400)
  }
}
