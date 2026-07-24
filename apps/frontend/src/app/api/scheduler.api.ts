import type { ITickSummary } from '~/app/types'
import { $api } from './client'

export abstract class SchedulerApi {
  // Runs the every-5-min scheduler now: video polling + Konci registrations + list sync.
  static run(): Promise<ITickSummary> {
    return $api('/api/scheduler/run', { method: 'POST' })
  }
}
