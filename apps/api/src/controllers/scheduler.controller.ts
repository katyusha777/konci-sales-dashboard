import { Controller } from '../lib/controller'
import { runCronTick } from '../scheduler'

// Manual trigger for the every-5-min scheduler — the same tick the cron runs (all ACTIVE
// campaigns' due sends + video polling), on demand. Useful for sending "the next batch"
// now instead of waiting for the cron. Rate limits still apply (they're time-windowed), so
// this can't send more than maxSendsPerHour/Day.
export default class SchedulerController extends Controller {
  // POST /api/scheduler/run
  async run() {
    return this.data(await runCronTick(this.c.env))
  }
}
