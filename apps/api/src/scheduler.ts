// Cron entry point. The api Worker's `scheduled` handler (src/index.ts) calls this
// every 5 minutes, and the authed POST /api/scheduler/run endpoint calls it on demand
// (for testing "the next batch" without waiting for the cron). All ticks are idempotent
// and DB-driven; one tick failing must not abort the others, so they run under
// Promise.allSettled.

import { createPrisma } from './lib/prisma'
import { CampaignService } from './services/campaign.service'
import { VideoService } from './services/video.service'

export interface TickSummary {
  emailsSent: number
  videosCompleted: number
  videosFailed: number
  videosProcessing: number
}

export async function runCronTick(env: Env): Promise<TickSummary> {
  const prisma = createPrisma(env.DATABASE_URL)
  const [send, poll] = await Promise.allSettled([
    CampaignService.runSendTick(prisma, env),
    VideoService.runPollTick(prisma, env),
  ])
  if (send.status === 'rejected')
    console.error('[scheduler] send tick failed:', send.reason)
  if (poll.status === 'rejected')
    console.error('[scheduler] poll tick failed:', poll.reason)

  return {
    emailsSent: send.status === 'fulfilled' ? send.value.sent : 0,
    videosCompleted: poll.status === 'fulfilled' ? poll.value.completed : 0,
    videosFailed: poll.status === 'fulfilled' ? poll.value.failed : 0,
    videosProcessing: poll.status === 'fulfilled' ? poll.value.processing : 0,
  }
}
