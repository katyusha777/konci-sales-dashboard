import type { Context } from 'hono'
import type { createPrisma } from './prisma'

export interface AppEnv {
  Bindings: Env
  Variables: {
    prisma: ReturnType<typeof createPrisma>
  }
}

export type AppContext<P extends string = string> = Context<AppEnv, P>
