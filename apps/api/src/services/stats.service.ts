// Dashboard overview — real aggregates over emails, events, videos, leads, and costs.
// Kept to straightforward Prisma counts/aggregates (no raw SQL): sendsByDay buckets a
// 30-day email fetch in JS, which is plenty at V1 scale.

import type { createPrisma } from '../lib/prisma'

type PrismaClient = ReturnType<typeof createPrisma>

const DAY_MS = 86_400_000

function utcDayStart(offsetDays = 0): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() - offsetDays * DAY_MS)
}

export abstract class StatsService {
  static async overview(prisma: PrismaClient) {
    const startToday = utcDayStart(0)
    const startYesterday = utcDayStart(1)
    const start7d = new Date(Date.now() - 7 * DAY_MS)
    const start30d = new Date(Date.now() - 30 * DAY_MS)

    const [sentToday, sentYesterday, sent7d, sent30d, totalSent, opened, clicked, videoPlays, costAgg, funnelRaw, recentEmails] = await Promise.all([
      prisma.email.count({ where: { sentAt: { gte: startToday } } }),
      prisma.email.count({ where: { sentAt: { gte: startYesterday, lt: startToday } } }),
      prisma.email.count({ where: { sentAt: { gte: start7d } } }),
      prisma.email.count({ where: { sentAt: { gte: start30d } } }),
      prisma.email.count({ where: { sentAt: { not: null } } }),
      prisma.email.count({ where: { events: { some: { type: 'OPENED' } } } }),
      prisma.email.count({ where: { events: { some: { type: 'CLICKED' } } } }),
      prisma.videoEvent.count({ where: { type: 'PLAY' } }),
      prisma.leadCost.aggregate({ _sum: { amountUsd: true } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.email.findMany({
        where: { sentAt: { gte: start30d } },
        select: { sentAt: true, events: { select: { type: true } } },
      }),
    ])

    // Bucket the last 30 days by UTC date
    const byDay = new Map<string, { sent: number, opened: number, clicked: number }>()
    for (let i = 29; i >= 0; i--)
      byDay.set(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10), { sent: 0, opened: 0, clicked: 0 })
    for (const e of recentEmails) {
      if (!e.sentAt)
        continue
      const key = e.sentAt.toISOString().slice(0, 10)
      const bucket = byDay.get(key)
      if (!bucket)
        continue
      bucket.sent++
      if (e.events.some(ev => ev.type === 'OPENED'))
        bucket.opened++
      if (e.events.some(ev => ev.type === 'CLICKED'))
        bucket.clicked++
    }

    return {
      sentToday,
      sentYesterday,
      sent7d,
      sent30d,
      openRate: totalSent ? opened / totalSent : 0,
      clickRate: totalSent ? clicked / totalSent : 0,
      videoPlays,
      totalCostUsd: Number(costAgg._sum.amountUsd ?? 0),
      funnel: funnelRaw.map(f => ({ status: f.status, count: f._count._all })),
      sendsByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    }
  }
}
