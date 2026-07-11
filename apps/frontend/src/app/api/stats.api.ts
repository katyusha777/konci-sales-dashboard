import type { IOverviewStats } from '~/app/types'
import { dummyStats } from '~/app/dummy-data/stats'
import { dummy } from './client'

// DUMMY-BACKED (frontend-first phase).
export abstract class StatsApi {
  static overview(): Promise<IOverviewStats> {
    return dummy(dummyStats)
  }
}
