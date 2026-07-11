# Konci Sales Dashboard

pnpm monorepo targeting Cloudflare.

## Packages

| Package | Path | Stack | Deploys to |
|---|---|---|---|
| `@konci/api` | `apps/api` | Hono + Prisma (Neon driver adapter) | Cloudflare Workers |
| `@konci/worker` | `apps/worker` | Cloudflare Worker with cron triggers | Cloudflare Workers |
| `@konci/frontend` | `apps/frontend` | Nuxt 4 (Vue 3) | Cloudflare Pages |

## Deployments

| App | URL |
|---|---|
| Frontend | https://konci-frontend.pages.dev |
| API | https://konci-api.patrickdeamorim.workers.dev ([health](https://konci-api.patrickdeamorim.workers.dev/api/health), [db health](https://konci-api.patrickdeamorim.workers.dev/api/health/db)) |
| Cron worker | https://konci-worker.patrickdeamorim.workers.dev (no HTTP routes — runs on cron) |

## Commands (from repo root)

```bash
pnpm dev:api        # Hono API on http://localhost:8787 (try /api/health)
pnpm dev:worker     # cron worker — trigger locally via:
                    #   curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
pnpm dev:frontend   # Nuxt on http://localhost:3000
pnpm build          # build all packages
pnpm typecheck      # typecheck api + worker
pnpm run deploy     # deploy all (needs `wrangler login` first; `run` is
                    #   required — plain `pnpm deploy` is a pnpm built-in)
pnpm deploy:api     # deploy a single app (also: deploy:worker, deploy:frontend)
```

## API structure

```
apps/api/src/
  index.ts          # Hono app: middleware, error handling
  routes/           # route definitions (mounted under /api)
  controllers/      # request handlers
  lib/prisma.ts     # createPrisma(databaseUrl) — client per request
  generated/prisma  # generated client (gitignored, run prisma:generate)
```

- Prisma 7 uses the `prisma-client` generator with `runtime = "workerd"` and a
  driver adapter (`@prisma/adapter-neon` for Neon Postgres — swap for
  `@prisma/adapter-d1` etc. if the database changes).
- The connection URL lives in `prisma.config.ts` (CLI, reads `.env`) and in
  `.dev.vars` (local `wrangler dev`). In production set it with
  `wrangler secret put DATABASE_URL`.
- After editing `prisma/schema.prisma`: `pnpm --filter @konci/api prisma:generate`
- After editing any `wrangler.jsonc`: `pnpm --filter <pkg> cf-typegen`

## Cron worker

Schedules are defined in `apps/worker/wrangler.jsonc` under `triggers.crons`
(UTC only). Each schedule is dispatched in `src/index.ts` to a job in `src/jobs/`.

## Frontend

Nuxt builds with the `cloudflare_pages` Nitro preset into `dist/`.
Deploy: `pnpm --filter @konci/frontend deploy`
(runs `wrangler pages deploy dist --project-name=konci-frontend`).
