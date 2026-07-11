import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { AppEnv } from './lib/context'
import { authMiddleware } from './middleware/auth.middleware'
import { prismaMiddleware } from './middleware/prisma.middleware'
import { routes } from './routes'

const app = new Hono<AppEnv>()

app.use('*', logger())
// No CORS needed: the frontend proxies /api through its own origin.
app.use('/api/*', prismaMiddleware)
app.use('/api/*', authMiddleware)

app.route('/', routes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
