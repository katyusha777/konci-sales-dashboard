// Cron entry point. The api Worker's `scheduled` handler (src/index.ts) calls this
// every 5 minutes. All ticks are idempotent and DB-driven; one tick failing must not
// abort the others, so they run under Promise.allSettled.

import { createPrisma } from './lib/prisma'
import { CampaignService } from './services/campaign.service'
import { VideoService } from './services/video.service'

export async function runCronTick(env: Env): Promise<void> {
  const prisma = createPrisma(env.DATABASE_URL)
  const results = await Promise.allSettled([
    CampaignService.runSendTick(prisma, env),
    VideoService.runPollTick(prisma, env),
  ])
  for (const r of results) {
    if (r.status === 'rejected')
      console.error('[scheduler] tick failed:', r.reason)
  }
}
