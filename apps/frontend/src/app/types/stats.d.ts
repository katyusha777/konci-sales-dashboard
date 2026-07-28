import type { TLeadStatus } from './lead'

export interface IOverviewStats {
  sentToday: number
  sentYesterday: number
  sent7d: number
  sent30d: number
  openRate: number
  clickRate: number
  videoPlays: number
  totalCostUsd: number
  funnel: Array<{ status: TLeadStatus, count: number }>
  sendsByDay: Array<{ date: string, sent: number, opened: number, clicked: number }>
}

// Mirrors the scheduler's TickSummary (apps/api/src/scheduler.ts).
export interface ITickSummary {
  videosCompleted: number
  videosFailed: number
  videosProcessing: number
  leadsEnriched: number
  konciRegistered: number
  konciPrepared: number
  leadsSynced: number
  leadsWaiting: number
  leadsSyncFailed: number
  statsUpserted: number
}
