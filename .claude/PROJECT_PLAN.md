# Konci Sales Dashboard — Project Plan

> The reference document for what we're building. Read this before working on features.
> Source material: the vibe-coded prototype at `/Users/katyusha/Desktop/konci-sales-pipeline`
> (referred to below as "the old repo") — mine it for integration code, not for architecture.

## 1. What this is

**Konci** is an AI phone operator: a business gets a phone number, callers hear an AI
("Hello, this is {business}, press 1 for…, or ask me anything"). This dashboard is the
**internal sales tool** used by 1–3 salespeople (Shaun et al.) to sell Konci to businesses:

1. **Get leads** — import CSV or search Scrap.io (Google Maps data) by industry/location.
2. **Enrich leads** — Scrap.io place details + Apollo contacts; score them; track cost.
3. **Personalized demo** — for the best ~1–5% of leads, auto-generate a HeyGen avatar video
   ("Hey {business}, we built this for you…"). Each demo lead gets a Konci trial phone
   number + PIN so they can call and experience their own AI receptionist.
4. **Campaigns** — drip email outreach (initial send + follow-ups) to selected leads, with
   rate limits and a global test mode.
5. **Track everything** — opens, clicks, video plays, demo calls; salesperson sees who's
   contacted / engaged / replied / closed, plus their Konci customer ID once converted.

**V1 scope (build now):** Lead management → Enrichment → Avatar & template management → Campaigns → Overview stats.

## 2. Architecture (this monorepo — already scaffolded and deployed)

| App | Stack | Deployed | Role |
|---|---|---|---|
| `apps/api` | Hono + Prisma (Neon PG) on CF Workers | konci-api.patrickdeamorim.workers.dev | All business logic, REST `/api/*` |
| `apps/worker` | CF Worker, cron triggers | konci-worker.patrickdeamorim.workers.dev | Scheduler: campaign sends, video polling |
| `apps/frontend` | Nuxt 4 (Vue 3) on CF Pages | konci-frontend.pages.dev | Dashboard UI + public video page |

Replaces from the old repo: NestJS→Hono, Next.js→Nuxt, Trigger.dev→cron worker + DB queue,
Turbo→plain pnpm workspace.

### Code conventions (established — follow these)

- **Controllers**: `export default class X extends Controller` (`lib/controller.ts`), methods
  take `req: AppRequest<{ Params: {...} }>`, return `this.data() / this.success() / this.error()`
  (`ApiResponse<T>` envelope). Routes bind via `action(Controller, 'method')`.
- **Services**: bluegem-style — one class per external API / domain concern in
  `src/services/`, static methods, no DI. External API services throw domain errors;
  controllers/jobs catch.
- **DTOs**: TypeScript types (+ zod schemas where validation is needed) in `src/dtos/`,
  named `{Domain}{Purpose}DTO`.
- **Enums**: `src/enums/`, string-backed, mirrored in Prisma enums.
- **Database**: snake_case plural tables via `@@map`, snake_case columns via `@map`,
  camelCase in code. Renames = hand-written `ALTER TABLE ... RENAME` migrations.
- **Shared code** between api/worker/frontend: extract to a `packages/shared` workspace
  package when first needed (types like `ApiResponse`, enums, DTO types).

## 3. Domain model (simplified — the whole point of the rewrite)

The old repo's Lead had 79 fields plus `LeadEnrichmentRun` (JSON step blobs),
`LeadResearchSnapshot` (unbounded markdown), `LeadResearchFact`, `LeadSourceRecord`,
merge/erase machinery. **All dropped.** Enrichment tracking collapses onto the Lead row +
a queryable cost ledger.

### Models (Prisma sketch — key fields, not exhaustive)

**Lead** (`leads`) — one business
- identity: `name`, `domain` (nullable, unique — dedup key), `googlePlaceId` (nullable unique — dedup key), `website`, `email`, `phone`
- location: `street`, `city`, `state`, `postalCode`, `country`, `industry`, `categories[]`
- quality: `googleRating`, `googleReviewCount`, `employeeCount`, `socialLinks Json?`
- enrichment extras: `services[]`, `businessHours Json?`, `description`, `ownerName`
  (from Scrap.io website data — added 2026-07-12 after reviewing the old app's lead pages)
- source: `source` enum (CSV | SCRAPIO | MANUAL), `sourceMeta Json?` (import batch, query used)
- enrichment: `enrichmentStatus` (PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED),
  `enrichmentScore` (Int 0–100), `enrichmentAttempts` (Int), `lastEnrichedAt`, `enrichmentError`
- sales pipeline: `status` enum (NEW | ENRICHED | IN_CAMPAIGN | CONTACTED | ENGAGED |
  REPLIED | CLOSED_WON | CLOSED_LOST | DO_NOT_CONTACT), `assignedTo` (string, email),
  `lastContactedAt`, `lastEngagedAt` (denormalized for list filters)
- konci: `konciCustomerId`, `demoPhone`, `demoPin`
- money: `totalCostUsd` (Decimal, denormalized from cost ledger)
- `notes` relation, timestamps

**Contact** (`contacts`) — person at a business
- `leadId`, `firstName`, `lastName`, `email` (unique per lead), `phone`, `jobTitle`,
  `linkedinUrl`, `priority` (Int — send order), `emailStatus` (UNKNOWN | VALID |
  BOUNCED | UNSUBSCRIBED | COMPLAINED), `source` (SCRAPIO | APOLLO | MANUAL)

**LeadNote** (`lead_notes`) — salesperson log: `leadId`, `author`, `body`, `createdAt`

**LeadCost** (`lead_costs`) — the cost ledger (replaces JSON step blobs)
- `leadId`, `type` enum (ENRICHMENT | VIDEO | EMAIL), `amountUsd` (Decimal),
  `description`, `meta Json?`, `createdAt`
- Reference prices from old repo: Scrap.io place ~$0.017-equivalent, Apollo match ~$0.04,
  HeyGen video ≫ everything (why only 1–5% of leads get one)

**Avatar** (`avatars`) — presenter for videos, created/trained in HeyGen studio, referenced here
- `name`, `heygenAvatarId`, `voiceId`, `previewImageUrl`, `isActive`, `lastSyncedAt`
- NO versions/groups/consent/asset tables (old repo) — HeyGen studio owns that lifecycle

**Template** (`templates`) — email + optional video, editable in place (NO versioning/AB tables)
- `name`, `subject`, `body` (HTML with `{{placeholders}}`)
- video part, two modes (2026-07-12): plain avatar video = `avatarId` + `videoScript`
  (ONE textarea); HeyGen studio template = `heygenTemplateId` + `videoScenes[]` (one text
  per scene — each scene is a HeyGen template variable, so scenes are structurally required)
- Placeholders: `{{business_name}} {{contact_first_name}} {{industry}} {{city}}
  {{video_url}} {{demo_phone}} {{demo_pin}} {{unsubscribe_url}}`
- Conditionals (kept dead simple, no nesting): `{{#if industry}}…{{/if}}` renders only
  when the variable is non-empty. Renderer lives in frontend `utils/template.ts`; the
  backend EmailService must implement the same two regexes.

**Campaign** (`campaigns`) — the rename of the old repo's "Workflow"
- `name`, `description`, `status` (DRAFT | ACTIVE | PAUSED | COMPLETED)
- limits: `maxSendsPerHour`, `maxSendsPerDay` (ENFORCED by the scheduler — the old repo
  defined these and never used them)
- `createdBy`, timestamps

**CampaignStep** (`campaign_steps`) — drip sequence (small table, not a JSON blob)
- `campaignId`, `order` (0 = initial send), `templateId`, `delayDays` (from previous step)

**CampaignLead** (`campaign_leads`) — per-lead campaign state machine
- `campaignId` + `leadId` (unique together), `contactId?` (who we're emailing)
- `status` (PENDING | SCHEDULED | SENT | COMPLETED | REPLIED | FAILED | CANCELLED | SUPPRESSED)
- `currentStep` (Int), `nextSendAt` (DateTime — the scheduler queries this),
  `withVideo` (Boolean — the 1–5% flag, set at selection time)

**Email** (`emails`) — one outbound send
- `campaignLeadId?`, `leadId`, `contactId?`, `templateId?`, `subject`
- `providerMessageId?`, `status` (PENDING | SENT | DELIVERED | OPENED | CLICKED | BOUNCED |
  COMPLAINED | FAILED), `trackingToken` (unique), `wasTestMode` (Boolean), `sentAt`

**EmailEvent** (`email_events`) — from Resend webhooks (svix-verified)
- `emailId`, `type` (DELIVERED | OPENED | CLICKED | BOUNCED | COMPLAINED | UNSUBSCRIBED),
  `externalId` (unique — webhook idempotency), `payload Json?`, `occurredAt`
- Resend handles open/click tracking; hard bounce/complaint auto-suppresses the contact
  and updates lead status. `trackingToken` on Email exists for the `/v/{token}` video link.

**Video** (`videos`) — one generated video
- `leadId`, `campaignLeadId?`, `templateId?`, `avatarId?`, `heygenVideoId`,
  `status` (PENDING | PROCESSING | COMPLETED | FAILED), `error`
- hosting: `r2Key` (downloaded from HeyGen → R2; no Mux), `durationSeconds`
- `token` (unique — public page `/v/{token}`), `costUsd`

**VideoEvent** (`video_events`) — posted by our own player page (no Mux analytics)
- `videoId`, `type` (PAGE_VIEW | PLAY | PAUSE | PROGRESS_25/50/75 | COMPLETED),
  `positionSeconds?`, `userAgent?`, `occurredAt`

**User** (`users`) — created/updated on first UniFi SSO login (no passwords, no registration)
- `email` (unique), `name`, `unifiSub` (unique — OIDC `sub` claim), `createdAt`
- Access control = who the client admits in UniFi Identity. Single role in V1.

**Session** (`sessions`) — `token` (unique), `userId`, `expiresAt`; httpOnly secure cookie,
auth middleware on all `/api/*` except public tracking/webhook/auth routes

### Explicitly dropped from the old repo (do not reintroduce without discussion)

Multi-tenancy/organizations, Better Auth tables, LeadEnrichmentRun, LeadResearchSnapshot,
LeadResearchFact, LeadSourceRecord, lead merge/erase machinery, Avatar versions/groups/
consent/assets, Template versions + variants + A/B experiments + editor-config SQL table,
PromptTemplate/PromptExecution (no LLM personalization in V1 — plain `{{var}}` substitution),
TrialPhoneNumber pool + TrialSession (demo phone/PIN live on Lead; provisioning is manual
until a Konci platform API exists), Mux, WebhookEvent table, AuditLog, PDL, FullEnrich,
Firecrawl, Google Places API, OpenRouter/Langfuse, Trigger.dev, Jambonz adapter.

## 4. Services (apps/api/src/services/)

Copy the good integration code from the old repo, cleaned into our static-class style:

| Service | Copy from (old repo) | Notes |
|---|---|---|
| `ScrapioService` | `packages/lead-sources/src/scrapio.adapter.ts` | Bearer auth, `GET /gmap/search` (country_code, city, admin1_code, type, per_page, cursor, rating/review filters) + `GET /gmap/place`. Cursor pagination. Copy nearly as-is. |
| `ApolloService` | `packages/enrichment/src/contact/apollo.adapter.ts` | `x-api-key`, `POST /v1/people/match` (name/domain/org). 404/422 → null. Copy nearly as-is. |
| `HeygenService` | `packages/video/src/index.ts` | `x-api-key`. `POST /v2/video/generate` (avatar+voice+script), `GET /v1/video_status.get`, `GET /v2/avatars`, `GET /v2/voices`, `GET /v2/templates` + `POST /v2/template/{id}/generate`. Skip the photo-training/digital-twin/upload endpoints. |
| `EmailService` | `packages/email/src/index.ts` + `apps/api/src/webhooks/resend.controller.ts` | **Resend** — send + svix webhook verification + event mapping; copy both from old repo. **Test mode enforced inside `send()`** (see §6). List-Unsubscribe headers. Keep the send call behind this one service so a provider swap stays a one-file change. |
| `AuthService` | — | **UniFi Identity SSO**: plain OIDC code flow (discovery URL → authorize redirect → token exchange → userinfo/id_token claims), upsert `users` row by `sub`, issue our session cookie. No Better Auth or other auth framework. |
| `EnrichmentService` | logic salvaged from `enrichment.task.ts` | Orchestrates: Scrap.io place refresh → Apollo contact match → compute score → write LeadCost rows → update Lead enrichment fields. Retry guard: skip if `enrichmentAttempts >= 3` or COMPLETED within 30 days (unless forced). |
| `CampaignService` | rewrite (old `workflow-run.task.ts` is the reference) | Add/remove leads, launch/pause, compute `nextSendAt`, template rendering (`{{var}}` substitution + missing-var validation). |
| `VideoService` | — | Create Video row + trigger HeygenService; download completed video → R2; token pages. |

**Enrichment score (keep it dumb and transparent, 0–100):** has website +15, has email +15,
has phone +10, google rating ≥ 4.0 +10, review count ≥ 20 +10, has ≥1 contact with valid
email +25, industry known +5, socials found +10. Threshold to auto-include in campaigns: ≥ 60.

## 5. Scheduler (apps/worker) — replaces Trigger.dev

Cron ticks (wrangler `triggers.crons`), all idempotent, all DB-driven:

- **Every 5 min — campaign sends**: for each ACTIVE campaign, count emails sent in the last
  hour/day vs `maxSendsPerHour/Day`; take due `campaign_leads` (`status IN (PENDING, SCHEDULED)
  AND nextSendAt <= now()`) up to remaining budget; for each: if `withVideo` and video not
  COMPLETED → trigger/await video first (re-check next tick); render template → create Email
  row → `EmailService.send()` → advance `currentStep`, set `nextSendAt` from next
  CampaignStep's `delayDays`, or mark COMPLETED. Skip/suppress leads that bounced,
  unsubscribed, replied, or are DO_NOT_CONTACT.
- **Every 5 min — video polling**: `videos.status = PROCESSING` → `HeygenService.videoStatus()`
  → on complete, download to R2, mark COMPLETED, write LeadCost.
- **Daily (02:00 UTC, existing)**: denormalized stat rollups if/when list queries get slow.

Rate-limit note: counting sent emails in a time window is the enforcement — simple,
correct-enough, no token buckets.

## 6. Test mode (env-driven, hard to get wrong)

The old repo had `const SEND_TO_OVERRIDE = "cody@hackhouse.io"` hardcoded in the task file.
Replace with env config, enforced INSIDE `EmailService.send()` (not at call sites):

```
EMAIL_TEST_MODE=true            # while true, every email goes to the test recipient
EMAIL_TEST_RECIPIENT=you@example.com
```

- When on: recipient replaced, subject prefixed `[TEST → original@dest]`, `emails.wasTestMode = true`.
- `EmailService` throws at startup if `EMAIL_TEST_MODE` is unset — an explicit `false` is
  required to send real email. Frontend shows a persistent banner when test mode is on
  (exposed via a config endpoint).

### Full env/secrets list (V1)

`DATABASE_URL` (exists) · `EMAIL_TEST_MODE` · `EMAIL_TEST_RECIPIENT` ·
`RESEND_API_KEY` · `RESEND_FROM_EMAIL` · `RESEND_WEBHOOK_SECRET` ·
`SCRAPIO_API_KEY` · `APOLLO_API_KEY` · `HEYGEN_API_KEY` ·
`GOOGLE_PLACES_API_KEY` (available — use only if enrichment ever needs data Scrap.io lacks) ·
`UNIFI_CLIENT_ID` · `UNIFI_CLIENT_SECRET` · `UNIFI_DISCOVERY_URL` ·
`AUTH_SECRET` (session signing) · `APP_URL` (tracking/video links) ·
R2 bucket binding `VIDEOS` (wrangler.jsonc).

All third-party keys were copied from the old repo's `.env.local` into `apps/api/.dev.vars`
(2026-07-11); set production values with `wrangler secret put`. The old `.env.local` also
contains `KONCI_SERVICE_TOKEN` + `API_BASE_URL` — evidence a Konci platform service API
already exists; investigate when the demo-number/PIN integration comes up.

## 7. Frontend pages (Nuxt)

> UI conventions, component library, API layer, and design language: `.claude/FRONTEND.md`.

- `/` — dashboard: emails sent today / yesterday / last 7 / 30 / 365 days, open rate,
  click rate, video plays, demo calls (later), cost totals, pipeline funnel by lead status.
- `/leads` — table with filters (status, industry, city/state, score range, campaign,
  assigned), bulk select → "Add to campaign" / "Enrich". Buttons: **Import CSV** (upload →
  column mapping → dedup by domain/place-id → report) and **Find leads** (Scrap.io search
  form: location, industry/type, min rating/reviews, has-website/phone → preview results →
  import selected).
- `/leads/:id` — everything about a lead: fields, score breakdown, contacts, emails +
  events timeline, videos, costs, notes, status changes, konci fields (customer ID,
  demo phone/PIN), enrich/re-enrich button.
- `/avatars` — grid with previews, "Sync from HeyGen" button, activate/deactivate.
- `/templates` — list + editor (subject, HTML body, video script, avatar picker,
  placeholder reference, live preview with a sample lead, "Generate test video").
- `/campaigns` — list with progress bars; create wizard: (1) name+limits, (2) steps
  (template + delay per step), (3) leads (manual picks or filter query; mark `withVideo`
  subset — manual or "top N by score"), (4) review & launch.
- `/campaigns/:id` — sends over time, per-step stats, engagement, pause/resume, per-lead states.
- `/v/:token` — PUBLIC video landing page: plays the R2 video (posts VideoEvents),
  shows "Call your demo: {demoPhone}, PIN {demoPin}", CTA link. No dashboard chrome.
- `/unsubscribe/:token` — public one-click unsubscribe.

## 8. Build order — FRONTEND-FIRST

Client decision (2026-07-11): build the entire frontend on **typed dummy data** first, so
the owner can click through and validate everything before any backend exists. The dummy
data lives in `apps/frontend/app/dummy-data/`, is typed against `app/types/` (which mirror
the §3 domain model), and **is the API contract**: backend phases replace dummy internals
of `app/api/*.api.ts` modules one domain at a time — page code never changes. The one
real backend slice built early is UniFi SSO auth (can't be dummied — needs the OIDC
secret exchange + session cookie).

**Phase F1 — Frontend shell + real auth**
Nuxt UI v4 setup · dashboard layout (sidebar/navbar) + public layout · `app/types/` for
all domains · `app/dummy-data/` seeded realistically · api modules returning dummy data ·
API: `users`/`sessions` migration, AuthService (UniFi OIDC), auth middleware, `/api/auth/*`
· `/api` proxied through Nuxt (first-party cookies, no CORS) · login page + route guard.

**Phase F2 — Full frontend on dummy data** *(iterate with the owner until it feels right)*
Leads list (filters, bulk select) + lead detail (contacts, timeline, costs, notes, konci
fields) · CSV import flow + Scrap.io search flow (simulated) · campaigns list/wizard/detail
· templates list/editor + preview · avatars grid · dashboard stats · `/v/[token]` +
unsubscribe public pages · empty/loading/error states.

**Phase B1 — Leads backend** *(schema migration for lead domain + swap dummy → real)*
Full Prisma schema · Lead/Contact/Note controllers · CSV import · ScrapioService + search
· swap `leads.api.ts` internals to `$api`.

**Phase B2 — Enrichment backend**: ApolloService · EnrichmentService (score, costs, retry
guard) · swap enrichment calls.

**Phase B3 — Avatars & Templates backend**: HeygenService · avatar sync · template CRUD ·
test video → R2 → real `/v/:token` + VideoEvents.

**Phase B4 — Campaigns backend**: campaign CRUD · EmailService (Resend + test mode) ·
worker scheduler (rate limits, video polling) · Resend webhooks → EmailEvent +
auto-suppression · unsubscribe.

**Phase B5 — Stats & polish**: real dashboard queries · CSV export · failure alerting.

**Later (explicitly out of V1):** Konci platform API integration (auto-provision demo
number/PIN, call + PIN-entry tracking — likely APIs or direct DB access, TBD by Konci) ·
inbound reply detection/parsing (salesperson marks REPLIED manually) · LLM
personalization · A/B variants · automated recurring Scrap.io searches ·
registration lockdown/roles · bounce/complaint tracking via provider webhooks ·
old-data migration from the prototype's Neon DB.

## 9. Decisions (answered by the client, 2026-07-11)

1. **Auth**: **UniFi Identity SSO** (client's infra; creds in env). Plain OIDC code flow +
   our own session cookie — no auth framework. Users auto-created on first login; access
   is managed in UniFi. Single role in V1. (Earlier open-registration idea superseded.)
   **Status 2026-07-11: PARKED** — API side fully built and protecting `/api/*`; first
   login attempt failed (likely `http://localhost:3000/api/auth/callback` not registered
   as a redirect URI in the UniFi OAuth app — the old repo used port 3001). Frontend
   route guard removed until this is sorted; `/login` still triggers the flow for testing.
2. **Konci demo number/PIN**: entered manually on the lead. Integration (API or direct DB)
   comes later from Konci's side — note `KONCI_SERVICE_TOKEN` in the old env suggests an
   API already exists.
3. **Email**: **Resend** (key + webhook secret + from-address all exist from the old
   project). Webhooks give open/click/bounce/complaint tracking. Keep sends behind
   `EmailService` so a provider change stays a one-file change. (Earlier SMTP idea
   superseded.)
4. **API keys**: reused from the old repo's `.env.local` — already copied into
   `apps/api/.dev.vars`.
5. **HeyGen**: keep simple — use avatars that exist in the HeyGen account + video
   generation. No photo-avatar training / digital-twin features.
6. **Data**: fresh start; migrate old leads later if ever needed.
