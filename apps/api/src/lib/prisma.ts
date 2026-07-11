import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client'

// Workers have no long-lived process — create the client per request
// (e.g. in a middleware) and pass c.env.DATABASE_URL.
export function createPrisma(databaseUrl: string) {
  const adapter = new PrismaNeon({ connectionString: databaseUrl })
  return new PrismaClient({ adapter })
}
