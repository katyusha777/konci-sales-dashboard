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
