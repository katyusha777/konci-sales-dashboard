# Smartlead Integration

> Read before touching anything Smartlead-related. Companion to `.claude/PROJECT_PLAN.md`.
> Written 2026-07-23 after browsing Smartlead's API docs and four owner decisions (below).

## 1. The strategic shift (owner decisions, 2026-07-23)

1. **Smartlead replaces internal Resend campaign sending.** This system's job narrows to:
   **lead miner + list organizer + stats mirror**. Cold outreach (sequences, sending,
   mailbox rotation, warmup, deliverability) is Smartlead's job. Resend stays for
   transactional/test email only. The B4 campaign scheduler/drip machinery gets **parked**
   once the Smartlead flow is proven end-to-end (not deleted yet — see §8 phase S6).
2. **Lists are first-class here; Smartlead has no list concept** (leads only exist inside
   campaigns). A local list can be **linked to one Smartlead campaign** — picked from a
   live dropdown of existing campaigns, or created empty (DRAFTED) via API. "Sync" pushes
   list members into the linked campaign.
3. **Sequences are authored in the Smartlead UI.** We never write sequence copy through
   the API. Our leverage is the **custom fields** we push with each lead
   (`video_url`, `video_thumbnail`, `demo_phone`, …) which Smartlead templates reference
   as merge variables.
4. **AI picks the outreach email automatically at the end of enrichment** (the
   key-decision-maker email among everything mining found). Manually overridable on the
   lead page; bulk action for already-enriched leads.

## 2. Provider-agnosticism (kept deliberately cheap)

We may swap Smartlead for another sending provider (Instantly, Lemlist, …) later. The
abstraction budget for that is exactly two things — **no adapter interfaces, no factory**
(minimalism mandate; build the interface when a second provider actually exists):

- All Smartlead HTTP lives behind `SmartleadService`. A swap = one new service.
- DB columns are generic: lists store `provider` (enum, currently just `SMARTLEAD`) +
  `externalCampaignId` (string); stat rows store the same pair. No Smartlead-shaped
  columns anywhere outside `raw` JSON.

## 3. Smartlead API notes (from docs browse, 2026-07-23)

- Base URL `https://server.smartlead.ai/api/v1` · auth = `?api_key=` **query param**.
- Docs: https://api.smartlead.ai/reference (also `/llms.txt`) and
  helpcenter.smartlead.ai article 125 "Full API Documentation".
- **API access requires their higher plan (Pro)** — key lives in `SMARTLEAD_API_KEY`.
- Rate limits vary by plan; 429 → back off. Standard HTTP error codes.
- Campaign statuses: `DRAFTED | ACTIVE | PAUSED | STOPPED | ARCHIVED`. Lead statuses:
  `STARTED | INPROGRESS | COMPLETED | BLOCKED`.

Endpoints we care about:

| Purpose | Endpoint |
|---|---|
| List campaigns | `GET /campaigns/` |
| Campaign detail | `GET /campaigns/{id}` |
| Create campaign (for "create from list") | `POST /campaigns/create` (starts DRAFTED) |
| Aggregate analytics | `GET /campaigns/{id}/analytics` |
| Per-lead/per-email stats (paginated, `event_time_gt` filter) | `GET /campaigns/{id}/leads-statistics` (a.k.a. statistics) |
| Leads in campaign (paginated) | `GET /campaigns/{id}/leads` |
| **Push leads** (max 400/request, ≤200 custom fields/lead, dedups) | `POST /campaigns/{id}/leads` with `{ lead_list: [{ email (required), first_name, last_name, company_name, website, phone_number, location, linkedin_profile, custom_fields: {...} }], settings: { ignore_duplicate_leads_in_other_campaign, … } }` → `{ added_count, skipped_count, skipped_leads }` |
| Lead by email (global) | `GET /leads/?email=` |
| Email accounts (sender mailboxes) | `GET /email-accounts/` |
| Webhooks (reply/bounce/unsub events) | `/webhooks` CRUD — **later**, polling first |

## 4. Domain model changes (proposed — owner must OK each migration)

### New tables (3)

**LeadList** (`lead_lists`)
- `name`, `description?`
- link: `provider` (enum `EmailProvider { SMARTLEAD }`, nullable — null = not linked),
  `externalCampaignId String?`, `lastSyncedAt DateTime?`
- timestamps

**LeadListMember** (`lead_list_members`)
- `listId` + `leadId` (unique together)
- `syncStatus` (`PENDING | SYNCED | FAILED | SKIPPED`), `syncedAt?`, `syncError?`
  (SKIPPED = no outreach email at sync time)
- `createdAt`

**ProviderEmailStat** (`provider_email_stats`) — the stats mirror, one row per
lead-email × sequence step, upserted on every pull
- `provider`, `externalCampaignId`, `externalLeadEmail`, `sequenceNumber`
  (unique together — upsert key)
- `leadId?` (matched by email against `leads.outreachEmail` / `contacts.email` at pull
  time; nullable because Smartlead campaigns may contain leads we didn't push)
- `sentAt?`, `openCount`, `clickCount`, `repliedAt?`, `bounced Boolean`, `raw Json?`
- `pulledAt`

Campaign-level aggregates are **not stored** — fetched live from `/analytics` when a
linked list/dashboard needs them (cheap, one call per campaign).

### Lead columns (added to `leads`)

- `outreachEmail String?` — the AI-chosen (or manually set) send-to address
- `outreachContactId String?` — FK → contacts, null when the pick is the lead-level email
- `outreachEmailReason String?` — one-line AI justification (shown in UI next to the pick)
- `videoUrl String?` — public video link the email image points to (usually our
  `/v/{token}` page; may be hand-set)
- `videoThumbnailUrl String?` — the image embedded in the email

`videoUrl`/`videoThumbnailUrl` deliberately duplicate what the `videos` table could
derive: the sync pushes whatever these columns hold, videos may be hand-made/external,
and VideoService can fill them automatically when a HeyGen video completes.

## 5. Sync flow (list → Smartlead)

1. Mine + enrich leads as today; organize into lists (bulk "Add to list" on `/leads`).
2. On the list page: **Link** → dropdown of live Smartlead campaigns, or "Create campaign
   from list" (`POST /campaigns/create`, named after the list, finished in Smartlead UI).
3. **Sync now** (button; later an opt-in cron): members with `syncStatus = PENDING`
   - no `outreachEmail` → mark `SKIPPED` (surfaced in UI so they can be fixed + re-synced)
   - chunk ≤ 400 → `POST /campaigns/{id}/leads` with custom fields:
     `first_name`, `last_name`, `company_name`, `website`, `phone_number`, `location`
     (native) + `custom_fields`: `industry`, `city`, `video_url`, `video_thumbnail`,
     `demo_phone`, `demo_pin`
   - mark `SYNCED` / `FAILED` (+ error verbatim); set `lastSyncedAt`
4. Sync is **one-way and additive** (we never delete/update leads in Smartlead from
   here in V1; re-sync only pushes never-synced members — Smartlead dedups by email
   anyway).

## 6. Stats pull (Smartlead → us)

- Scheduler tick (existing cron worker, e.g. **hourly**): for each list with a linked
  campaign, `GET /campaigns/{id}/leads-statistics` paginated, with `event_time_gt` =
  `lastSyncedAt`-style watermark (stored per list) to keep pulls incremental.
- Upsert into `provider_email_stats`; match `leadId` by email.
- Denormalize onto the lead: first `sentAt` → `lastContactedAt` + status `CONTACTED`;
  opens/clicks → `lastEngagedAt` + `ENGAGED`; `repliedAt` → `REPLIED`; bounce → contact
  `emailStatus = BOUNCED`.
- Lead detail page gets a "Outreach" section (per-step sent/opened/clicked/replied);
  dashboard funnel keeps working off lead statuses.
- **Later:** Smartlead webhooks for instant reply/bounce (polling is fine to start).

## 7. AI outreach-email pick

- New `OpenrouterService.pickOutreachEmail(env, input)`: given the lead's own email +
  all contacts (name, title, email, email status, source, confidence), returns
  `{ email, contactRef | null, reason }` — prompt targets "who is the key decision
  maker for buying an AI phone operator" (owner > GM > manager > generic inbox).
- Runs automatically at the **end of `EnrichmentService.run`**, only when
  `outreachEmail` is null (a manual pick is never overwritten; re-enrich with `force`
  re-picks). Cost: one small LLM call, logged to `enrichment_responses` like the rest.
- Manual: editable on lead detail (dropdown of all known emails + free text); bulk
  "Pick outreach emails" action on `/leads` for already-enriched leads.

## 8. Build phases

- **S1 — SmartleadService + playground** *(built 2026-07-23, this session)*:
  `smartlead.service.ts` (campaigns, analytics, statistics, campaign leads, push leads,
  email accounts) · playground endpoints `/api/playground/smartlead/*` · playground page
  · `SMARTLEAD_API_KEY` env. Validate every call live before building on it.
- **S2 — Lists** *(DONE 2026-07-23)*: `lead_lists` + `lead_list_members` migration
  (`20260723161409_lead_lists`) · `LeadListService` + `LeadListController` + `/api/lists/*`
  · `/lists` + `/lists/:id` pages · bulk "Add to list" on `/leads` (existing list or
  create-inline) · `SYNCED` added to StatusBadge. Sync fields (`provider`,
  `externalCampaignId`, `syncStatus`…) exist in the schema but linking/sync UI is S3.
- **S3 — Sync** *(DONE 2026-07-23)*: lists gained `status` (DRAFT | ACTIVE | PAUSED,
  default DRAFT) — **nothing sends until the owner Activates** (activation requires a
  linked campaign; picker on the list page reads live campaigns via
  `GET /api/lists/smartlead-campaigns`). Cron sync tick (staged register → poll →
  sync): ACTIVE linked lists push PENDING members to Smartlead in ≤100 batches.
  **Hard eligibility gate (owner rule)**: Konci registration PREPARED + claim URL,
  plus a usable email (`resolveOutreachEmail`: priority contact → lead email —
  superseded by S4b's AI pick later). Ineligible members stay PENDING with the reason
  in `syncError` and flow automatically once ready. Custom fields pushed:
  `business_name, industry, city, video_url, video_thumbnail, demo_phone, demo_pin,
  claim_url`. Verified live 2026-07-23: full chain (register → prepared → sync) landed
  a lead in campaign #3711196 with all fields.
- **S4a — Video templates + outreach video fields** *(DONE 2026-07-23)*: migration
  `20260723183433_video_templates` — `templates.subject/body` nullable (LEGACY email
  part; Smartlead owns email copy), `templates.voice_id` (per-template voice override,
  falls back to the avatar's), `videos.thumbnail_r2_key`, `leads.video_url` +
  `leads.video_thumbnail_url`. `/templates` page rewritten video-first (avatar gallery
  with previews, voice picker via `GET /api/templates/voices`, script + placeholder
  chips + `{{#if}}`, rendered preview). Lead detail: "Outreach video" card
  (template pick + test/real toggle, `POST /api/videos {test}`) + Videos tab
  (thumbnails, watch/copy links). Poll tick now also downloads the HeyGen thumbnail
  to R2 (their URLs expire ~7 days) and stamps the lead: `videoUrl = APP_URL/v/{token}`,
  `videoThumbnailUrl = APP_URL/api/v/{token}/thumb` (new public endpoint) — newest
  completed render wins. *Update 2026-07-24*: when `VIDEOS_PUBLIC_URL` (wrangler.jsonc
  var = the konci-videos bucket's public r2.dev/custom domain) is set, the thumbnail is
  stamped with the direct R2 CDN URL instead, and `/v/:token` streams the mp4 straight
  from the CDN (`videoSrc` in the page payload; Worker `/stream` stays as fallback).
  The R2 binding is `"remote": true` so local dev writes to the real bucket — videos
  generated on localhost get working public URLs. Setup (one-time, owner):
  `wrangler r2 bucket dev-url enable konci-videos`, paste the URL into the var.
  *Also 2026-07-24 — force resync*: `POST /api/lists/:id/resync` (+ `/members/:memberId/resync`)
  re-pushes member(s) on demand (buttons on the list page: per-row + "Force resync all"
  in the ⋯ menu). It first re-stamps the lead's video_url/thumbnail from the newest
  completed render with the CURRENT env (stored absolute URLs rot when APP_URL /
  VIDEOS_PUBLIC_URL change). Leads already present in Smartlead (decided by
  `fetchLeadByEmail`, NOT local syncStatus) get `updateLeadCustomFields` in place —
  Smartlead's add API dedup-skips without updating fields, and its update endpoint
  requires `email` in the body (400 without it, bug fixed 2026-07-24). Absent leads go
  through the normal add path, ACTIVE lists only — the send gate holds. **Smartlead email snippet** (their `{{#if}}` liquid support is
  confirmed): `{{#if video_url}}<a href="{{video_url}}"><img src="{{video_thumbnail}}"
  width="480" alt="A video we made for you"/></a>{{/if}}`.
  Video provider-openness: same rule as email (§2) — all HeyGen HTTP stays in
  `HeygenService`; add a provider enum/rename `heygenVideoId` when provider #2 exists.
  HeyGen quirk: the owner's "Shaun Sanders" instant avatar reports `is_custom: false`,
  so `POST /api/avatars/sync` (custom-only) misses it — row inserted by hand 2026-07-23;
  revisit sync's filter if more avatars appear.
- **S4b — Outreach email (AI pick)** *(DONE 2026-07-23)*: lead columns `outreachEmail`/
  `outreachContactId`/`outreachEmailReason` (migration `..._outreach_email_stats`) ·
  `OpenrouterService.pickOutreachEmail` (FLASH model, candidates = contacts + lead
  inbox, pick validated against candidates verbatim, logged to enrichment_responses as
  `pick_outreach_email` ~$0.002) · runs at the end of every successful enrichment (force
  re-enrich re-picks; an existing pick is otherwise never overwritten) · manual: editable
  on the lead card (sets reason "Set manually"), bulk "Pick emails (AI)" on /leads,
  `POST /api/leads/:id/pick-outreach-email` · `resolveOutreachEmail` prefers the pick,
  falls back to best contact → lead inbox. Verified live (picked the owner w/ reason).
- **S3 addendum**: when a video completes for a lead that is already SYNCED in a linked
  list, update its Smartlead custom fields via `POST /campaigns/{id}/leads/{lead_id}`
  so `video_url`/`video_thumbnail` never go stale.
- **S5 — Stats mirror** *(DONE 2026-07-23; awaiting first real sends)*:
  `provider_email_stats` table + `lead_lists.stats_pulled_at` watermark ·
  `LeadListService.runStatsPullTick` (every cron tick, throttled ≥30 min/list; pages
  `/campaigns/{id}/statistics` 100/page w/ `event_time_gt` = watermark − 1 day slack,
  ≤2000 rows/tick) · upsert key (provider, campaign, email, step) · leadId matched by
  outreachEmail/lead email/contact email · funnel denormalization: sent → CONTACTED,
  open/click → ENGAGED, reply → REPLIED (forward-only; CLOSED_*/DO_NOT_CONTACT never
  touched), bounce → contact BOUNCED · lead detail "Smartlead outreach" block in the
  Emails tab. Endpoint + mapping verified live (`total_stats`/`data` shape confirmed;
  0 rows until the campaign's first send window). **Video-after-sync**: video poll tick
  now refreshes `video_url`/`video_thumbnail` on already-SYNCED Smartlead leads via
  `GET /leads?email=` + `POST /campaigns/{id}/leads/{lead_id}` (untested live — needs a
  synced lead + late video; watch the first occurrence).
- **S6 — Decommission** *(DONE 2026-07-23, owner order)*: internal campaign machinery
  REMOVED — `campaigns`/`campaign_steps`/`campaign_leads` tables dropped (migration
  `20260723185833`), `templates.subject/body` dropped (templates are video-only now),
  CampaignService/controller/routes/pages deleted, scheduler send-tick replaced by the
  konci + sync ticks. Resend (`EmailService`) + `emails`/`email_events` + webhook +
  unsubscribe stay for transactional/test use.

Phases need owner sign-off table-by-table (working agreement) — S2/S4/S5 each add
schema.

## 9. Konci platform registration (added 2026-07-23)

Every outreach lead gets a **test account on the main Konci system** (staging:
`app-staging.konci.ai`, `Bearer KONCI_LEADS_API_SECRET`; env `KONCI_API_URL`).
**A lead is NEVER pushed to Smartlead without a PREPARED registration** — the sync
tick enforces it.

- `KonciService` — HTTP adapter: `POST /api/internal/leads` (business_name+website
  required; contact_name/social_media/team_size optional) → 202 `{lead_id, status:
  pending, claim_url, claim_expires_at}`; `GET /{id}` poll (~80s to terminal:
  prepared | needs_phone | failed | skipped); `POST /{id}/retry` (those three only);
  `POST /{id}/claim-link`. Playground page `/playground/konci`.
- `KonciRegistrationService` — orchestration + `konci_registrations` table (one row
  per lead: status, claimUrl, claimExpiresAt, error, raw, lastPolledAt — the audit of
  when each status landed). Cron: **register tick** (any list member without a
  registration, needs website) then **poll tick** (PENDING rows). Confirmed live field
  names in their GET: `demo_number`, `demo_pin`, `business_id` — lifted onto the lead
  as `demoPhone`/`demoPin`/`konciCustomerId` when PREPARED. GET returns `claim_url:
  null` (claim data only on register/claim-link responses) — applyResult keeps the
  stored value.
- Lead page: "Konci platform" card — register / check status / retry / mint new claim
  link, claim URL + expiry visible. Manual actions: `POST /api/leads/:id/konci/
  register|refresh|retry|claim-link`.

## 10. Open items

- `SMARTLEAD_API_KEY` set in `.dev.vars` 2026-07-23 and verified live (campaigns +
  email accounts return real data). Still needs `wrangler secret put` for prod.
- Statistics response field names in their docs are thin — S1 playground page shows raw
  JSON precisely so we can confirm shapes before designing the S5 upsert mapping.
- E2E test artifacts (2026-07-23): list "Flow test (E2E)" (PAUSED after the test);
  Katyusha Ice Wear lead is registered on Konci staging AND enrolled in Smartlead
  campaign #3711196 (contact katya@katyushaicewear.com) — **Smartlead may email it in
  the next send window**; remove it in Smartlead if unwanted.
- Smartlead custom fields are set at push time — if a video is generated AFTER a lead
  synced, update it via `POST /campaigns/{id}/leads/{lead_id}` (not built yet).
- Webhooks vs polling cadence for replies — revisit at S5.
