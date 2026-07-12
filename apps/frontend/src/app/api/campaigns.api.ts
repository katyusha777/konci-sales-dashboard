import type { ICampaign, ICampaignCreate, ICampaignDetail } from '~/app/types'
import { $api } from './client'

export abstract class CampaignsApi {
  static list(): Promise<Array<ICampaign>> {
    return $api('/api/campaigns')
  }

  static get(id: string): Promise<ICampaignDetail> {
    return $api(`/api/campaigns/${id}`)
  }

  static setStatus(id: string, status: ICampaign['status']): Promise<ICampaign> {
    return $api(`/api/campaigns/${id}`, { method: 'PATCH', body: { status } })
  }

  // Creates a DRAFT with its steps and enrolled leads (best emailable contact per lead;
  // top-N by score flagged withVideo). Activate it from the campaign detail page.
  static create(input: ICampaignCreate): Promise<ICampaign> {
    return $api('/api/campaigns', { method: 'POST', body: input })
  }
}
