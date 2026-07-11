import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { AppEnv } from './lib/context'
import { prismaMiddleware } from './middleware/prisma.middleware'
import { routes } from './routes'

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use('/api/*', cors())
app.use('/api/*', prismaMiddleware)

app.route('/', routes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
