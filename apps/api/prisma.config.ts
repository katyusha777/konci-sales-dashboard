import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Used by the Prisma CLI (migrate, studio) — reads .env via dotenv above
  datasource: {
    url: env('DATABASE_URL'),
  },
})
