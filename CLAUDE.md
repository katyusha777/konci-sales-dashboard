# Konci Sales Dashboard

Internal sales tool for Konci (AI phone operator for businesses): lead management,
enrichment, avatar-video demos, drip email campaigns.

**Read `.claude/PROJECT_PLAN.md` before building features** — it defines the domain model,
services, scheduler design, build phases, and (importantly) what was deliberately dropped
from the old prototype. Keep everything minimal and straightforward: no versioning, no
audit machinery, no speculative abstraction. When in doubt, fewer tables and fewer layers.
**Read `.claude/ENRICHMENT.md` before touching enrichment** — providers, flows, costs,
confidence rules. **Read `.claude/TELEPHONY.md` before touching telephony** — it hits
Konci's production phone infrastructure. The old repo is fully audited — before mining
it for anything, check `.claude/OLD_REPO_AUDIT.md` (what's ported / what to mine per
phase / what to ignore).

## Monorepo

- `apps/api` — Hono + Prisma (Neon) on CF Workers. Laravel-style: class controllers
  extending `lib/controller.ts` (`this.data()/success()/error()`), routes bind with
  `action(Controller, 'method')`, static Service classes in `src/services/`. The Worker
  exports **both** `fetch` (Hono) and `scheduled` (the every-5-min scheduler —
  `src/scheduler.ts`); it also has an R2 bucket binding `VIDEOS` for generated videos.
- `apps/worker` — **RETIRED** (scheduler moved into `apps/api`). No cron; kept only so the
  existing deployment isn't orphaned.
- `apps/frontend` — Nuxt 4 + Nuxt UI v4 on CF Pages. See `.claude/FRONTEND.md` for the
  UI/API-layer/design conventions before touching it.

## Working agreement (owner legibility — non-negotiable)

The owner must always be able to read and manage this codebase himself. Therefore:

- **No new dependencies, database tables, or services without asking first.** Not even
  small ones. "While I was at it" additions are banned.
- **Keep code and `.claude/PROJECT_PLAN.md` in sync** — if implementation diverges from
  the plan, update the plan in the same session and say so.
- **One way to do things**: feature = route → controller → service → Prisma model;
  frontend page = page → api module → typed response. No parallel patterns, no clever
  abstractions, no premature generality.
- **After each phase, deliver a short written tour**: what was added, which files, why —
  so the owner reviews phase-by-phase, never a wall of unreviewed code.
- **Every third-party service gets a Playground page.** When adding a service to
  `apps/api/src/services/`, also add: (1) playground endpoints on
  `/api/playground/<service>/*` that call it live and surface provider errors verbatim
  via `this.error(message, rawError)`, and (2) a page under
  `apps/frontend/src/pages/playground/` (linked as a child of the "Playground" sidebar
  item) where the owner can exercise every call with live data, see mapped results AND
  the raw JSON (`<RawJson>`), and see cost warnings on calls that consume credits.
  This is how integrations get validated BEFORE features are built on them.

## Conventions

- DB: snake_case plural tables (`@@map`), snake_case columns (`@map`); renames are
  hand-written `ALTER TABLE ... RENAME` migrations (Prisma default drops data).
- **All primary keys are UUIDv7**: `String @id @default(uuid(7)) @db.Uuid` — time-ordered
  (rows sort by creation), generated client-side by Prisma. Every new table follows this.
- Prisma CLI uses `apps/api/.env` (direct Neon URL); runtime uses `.dev.vars` / Worker
  secret (pooler URL).
- Deploy: `pnpm run deploy` from root (`run` is required), or `pnpm deploy:api|worker|frontend`.
- Email sending must respect `EMAIL_TEST_MODE` (see plan §6) — never bypass it.
