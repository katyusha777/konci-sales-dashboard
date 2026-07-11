import type { IOverviewStats } from '~/app/types'

export const dummyStats: IOverviewStats = {
  sentToday: 14,
  sentYesterday: 22,
  sent7d: 131,
  sent30d: 476,
  openRate: 0.41,
  clickRate: 0.12,
  videoPlays: 38,
  totalCostUsd: 214.37,
  funnel: [
    { status: 'NEW', count: 214 },
    { status: 'ENRICHED', count: 122 },
    { status: 'IN_CAMPAIGN', count: 74 },
    { status: 'CONTACTED', count: 58 },
    { status: 'ENGAGED', count: 23 },
    { status: 'REPLIED', count: 9 },
    { status: 'CLOSED_WON', count: 3 },
    { status: 'CLOSED_LOST', count: 6 },
  ],
  sendsByDay: [
    { date: '2026-07-05', sent: 18, opened: 8, clicked: 2 },
    { date: '2026-07-06', sent: 25, opened: 11, clicked: 3 },
    { date: '2026-07-07', sent: 20, opened: 7, clicked: 2 },
    { date: '2026-07-08', sent: 16, opened: 8, clicked: 3 },
    { date: '2026-07-09', sent: 16, opened: 5, clicked: 1 },
    { date: '2026-07-10', sent: 22, opened: 9, clicked: 2 },
    { date: '2026-07-11', sent: 14, opened: 4, clicked: 1 },
  ],
}
