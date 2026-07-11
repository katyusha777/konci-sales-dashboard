import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/context'
import { createPrisma } from '../lib/prisma'

export const prismaMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('prisma', createPrisma(c.env.DATABASE_URL))
  await next()
})
