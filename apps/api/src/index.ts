import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { AppEnv } from './lib/context'
import { authMiddleware } from './middleware/auth.middleware'
import { prismaMiddleware } from './middleware/prisma.middleware'
import { routes } from './routes'
import { runCronTick } from './scheduler'

const app = new Hono<AppEnv>()

app.use('*', logger())
// No CORS needed: the frontend proxies /api through its own origin.
// Local dev has no cron (`wrangler dev` never fires `scheduled`), so PENDING Konci
// registrations / PROCESSING videos only progressed on manual clicks. Self-tick: any
// API request on localhost runs the scheduler, at most once a minute, off the request
// path via waitUntil (before auth — runCronTick needs no request context). Production
// hostnames never match, so this is dev-only.
let lastDevTick = 0
app.use('/api/*', async (c, next) => {
  const host = new URL(c.req.url).hostname
  if ((host === 'localhost' || host === '127.0.0.1') && Date.now() - lastDevTick > 60_000) {
    lastDevTick = Date.now()
    console.log('[dev-tick] running scheduler')
    c.executionCtx.waitUntil(runCronTick(c.env).catch(err => console.error('[dev-tick]', err)))
  }
  await next()
})

app.use('/api/*', prismaMiddleware)
app.use('/api/*', authMiddleware)

app.route('/', routes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.onError((err, c) => {
  console.error(err)
  // Internal tool: surface the real error in the standard envelope so the UI can show it.
  return c.json({ success: false, message: err.message || 'Internal Server Error', info: err.stack ?? null }, 500)
})

// The Worker exports BOTH handlers: `fetch` (the Hono app) and `scheduled` (the cron
// scheduler). The scheduled handler does not run Hono middleware, so runCronTick builds
// its own Prisma client.
export default {
  fetch: app.fetch,
  scheduled: async (_controller, env, ctx) => {
    ctx.waitUntil(runCronTick(env))
  },
} satisfies ExportedHandler<Env>
