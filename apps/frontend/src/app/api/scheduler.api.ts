import type { ITickSummary } from '~/app/types'
import { $api } from './client'

export abstract class SchedulerApi {
  // Runs the every-5-min scheduler now: due campaign sends + video polling.
  static run(): Promise<ITickSummary> {
    return $api('/api/scheduler/run', { method: 'POST' })
  }
}
