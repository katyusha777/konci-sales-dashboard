import type { ILeadList, ILeadListMembers, IListResyncSummary, ISmartleadLiveCampaign, TListStatus } from '~/app/types'
import { $api } from './client'

export abstract class ListsApi {
  static list(): Promise<Array<ILeadList>> {
    return $api('/api/lists')
  }

  static get(id: string): Promise<ILeadList> {
    return $api(`/api/lists/${id}`)
  }

  static members(id: string, page = 1, perPage = 25): Promise<ILeadListMembers> {
    return $api(`/api/lists/${id}/members`, { query: { page, perPage } })
  }

  static create(input: { name: string, description?: string }): Promise<ILeadList> {
    return $api('/api/lists', { method: 'POST', body: input })
  }

  static update(id: string, input: { name?: string, description?: string | null, externalCampaignId?: string | null, status?: TListStatus }): Promise<ILeadList> {
    return $api(`/api/lists/${id}`, { method: 'PATCH', body: input })
  }

  // Live Smartlead campaigns for the link picker.
  static smartleadCampaigns(): Promise<Array<ISmartleadLiveCampaign>> {
    return $api('/api/lists/smartlead-campaigns')
  }

  static remove(id: string): Promise<void> {
    return $api(`/api/lists/${id}`, { method: 'DELETE' })
  }

  static addLeads(id: string, leadIds: Array<string>): Promise<{ added: number, duplicates: number }> {
    return $api(`/api/lists/${id}/leads`, { method: 'POST', body: { leadIds } })
  }

  static removeMember(id: string, memberId: string): Promise<void> {
    return $api(`/api/lists/${id}/members/${memberId}`, { method: 'DELETE' })
  }

  // Force re-push to Smartlead: one member, or every member of the list.
  // Synced leads get their custom fields updated in place; the rest re-enter the add flow.
  static resync(id: string, memberId?: string): Promise<IListResyncSummary> {
    return $api(memberId ? `/api/lists/${id}/members/${memberId}/resync` : `/api/lists/${id}/resync`, { method: 'POST' })
  }
}
