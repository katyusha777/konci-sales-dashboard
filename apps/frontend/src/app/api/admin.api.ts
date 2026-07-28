import type { IAdminCounts } from '~/app/types'
import { $api } from './client'

export abstract class AdminApi {
  static counts(): Promise<IAdminCounts> {
    return $api('/api/admin/counts')
  }

  static deleteAllLeads(): Promise<{ deleted: number }> {
    return $api('/api/admin/delete-all-leads', { method: 'POST' })
  }

  static deleteAllLists(): Promise<{ deleted: number }> {
    return $api('/api/admin/delete-all-lists', { method: 'POST' })
  }
}
