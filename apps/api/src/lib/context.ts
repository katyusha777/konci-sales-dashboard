import type { Context } from 'hono'
import type { createPrisma } from './prisma'
import type { AuthUser } from '../services/auth.service'

export interface AppEnv {
  Bindings: Env
  Variables: {
    prisma: ReturnType<typeof createPrisma>
    user: AuthUser
  }
}

export type AppContext<P extends string = string> = Context<AppEnv, P>
