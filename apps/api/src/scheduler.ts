// Cron entry point. The api Worker's `scheduled` handler (src/index.ts) calls this
// every 5 minutes, and the authed POST /api/scheduler/run endpoint calls it on demand.
// All ticks are idempotent and DB-driven; one tick failing must not abort the others,
// so they run under Promise.allSettled.
//
// Ticks:
//  1. videos      — poll HeyGen for PROCESSING renders → download video+thumb to R2
//  2. konci reg   — auto-register list members on the Konci platform (owner rule:
//                   a lead is never pushed to Smartlead without a Konci account)
//  3. konci poll  — poll PENDING registrations until terminal (~80s pipeline)
//  4. list sync   — push eligible members of ACTIVE linked lists to Smartlead
//  5. stats pull  — mirror Smartlead per-lead email stats (throttled ~30 min/list)

import { createPrisma } from './lib/prisma'
import { KonciRegistrationService } from './services/konci-registration.service'
import { LeadListService } from './services/lead-list.service'
import { VideoService } from './services/video.service'

export interface TickSummary {
  videosCompleted: number
  videosFailed: number
  videosProcessing: number
  konciRegistered: number
  konciPrepared: number
  leadsSynced: number
  leadsWaiting: number
  leadsSyncFailed: number
  statsUpserted: number
}

export async function runCronTick(env: Env): Promise<TickSummary> {
  const prisma = createPrisma(env.DATABASE_URL)

  // Strictly staged: register → poll → sync, so a registration that just turned
  // PREPARED is synced on the SAME tick (sync must see the poll's writes).
  const [videos, konciReg] = await Promise.allSettled([
    VideoService.runPollTick(prisma, env),
    KonciRegistrationService.runRegisterTick(prisma, env),
  ])
  const [konciPoll] = await Promise.allSettled([KonciRegistrationService.runPollTick(prisma, env)])
  const [sync, stats] = await Promise.allSettled([
    LeadListService.runSyncTick(prisma, env),
    LeadListService.runStatsPullTick(prisma, env),
  ])

  for (const [name, result] of [['videos', videos], ['konci-register', konciReg], ['konci-poll', konciPoll], ['list-sync', sync], ['stats-pull', stats]] as const) {
    if (result.status === 'rejected')
      console.error(`[scheduler] ${name} tick failed:`, result.reason)
  }

  return {
    videosCompleted: videos.status === 'fulfilled' ? videos.value.completed : 0,
    videosFailed: videos.status === 'fulfilled' ? videos.value.failed : 0,
    videosProcessing: videos.status === 'fulfilled' ? videos.value.processing : 0,
    konciRegistered: konciReg.status === 'fulfilled' ? konciReg.value.registered : 0,
    konciPrepared: konciPoll.status === 'fulfilled' ? konciPoll.value.prepared : 0,
    leadsSynced: sync.status === 'fulfilled' ? sync.value.synced : 0,
    leadsWaiting: sync.status === 'fulfilled' ? sync.value.waiting : 0,
    leadsSyncFailed: sync.status === 'fulfilled' ? sync.value.failed : 0,
    statsUpserted: stats.status === 'fulfilled' ? stats.value.statsUpserted : 0,
  }
}
