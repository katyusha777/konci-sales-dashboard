import type { IOverviewStats } from '~/app/types'
import { $api } from './client'

export abstract class StatsApi {
  static overview(): Promise<IOverviewStats> {
    return $api('/api/stats/overview')
  }
}
