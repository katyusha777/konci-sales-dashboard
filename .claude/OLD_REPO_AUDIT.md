# Old repo audit & salvage ledger

> Full-inventory audit of `/Users/katyusha/Desktop/konci-sales-pipeline` (2026-07-12).
> **Verdict: stop using the old repo as a day-to-day reference.** Everything either lives
> in this repo (top section — with how it works), is scheduled for a specific phase
> (middle section — with exact old-repo paths), or is deliberately ignored (bottom).
> Keep an archived copy until Phases B4/B5 land, then delete. This file is the map —
> never re-explore the old repo from scratch.

## Salvaged & working (live-tested in the playground)

Everything here has a service, a playground page, and was exercised against the real
provider. How each *integration* works: `.claude/ENRICHMENT.md` (Scrap.io, Google Places,
Firecrawl, OpenRouter, Apollo, PDL, Hunter, FullEnrich) and `.claude/TELEPHONY.md`
(Jambonz). Three cross-cutting utilities were salvaged separately and need their own
explanation so they don't become orphan code:

### 1. LLM CSV header mapping — `OpenrouterService.mapCsvHeaders`
- **Where:** `apps/api/src/services/openrouter.service.ts` (+ the exported
  `CSV_TARGET_FIELDS` list) · playground: OpenRouter page, "CSV header mapping" section.
- **What it's for:** the Phase B1 "Import CSV" flow. Salespeople upload CSVs with
  arbitrary column names ("Town", "Stars", "Owner First"); this maps them onto our lead
  fields so the import wizard can prefill its column-mapping step.
- **How it works:** one cheap LLM call (Gemini flash-lite) with **json_schema structured
  output** — the schema requires every target field, typed `string|null`, so the response
  always has every key. Two guards: the model only sees real headers, and the code
  re-checks each returned value against the header list (a hallucinated column becomes
  null). `CSV_TARGET_FIELDS` mirrors plan §3's Lead + Contact fields — extend it there
  when the schema grows.
- **Live test:** a messy 12-column CSV mapped 10/12 correctly (Town→city,
  Stars→google_rating, Owner First→contact_first_name); the two nulls were genuinely
  unmappable. B1 still needs a real CSV *parser* (quoting) — the playground uses a naive
  comma split on purpose.

### 2. FullEnrich reverse-email BATCH — `FullenrichService.submitReverseEmailBatch` / `getReverseEmailBatchResult`
- **Where:** `apps/api/src/services/fullenrich.service.ts` · playground: FullEnrich page,
  "Reverse email BATCH" section.
- **What it's for:** Phase B2 bulk enrichment — when many contacts have only an email,
  batching beats one submit+poll per contact ($0.03/email either way, but 1 poll loop
  instead of N).
- **How it works:** same async submit → poll contract as the single version, but `data`
  is an array and the FINISHED payload returns one record per submitted email (matched by
  `input.email`; `result: null` = no match). The API rejects oversized batches with
  `error.enrichment.data.too_many` (no documented limit) — the service throws a clear
  error; the **halve-and-resubmit retry loop is deliberately NOT in the service**, it
  belongs to the B2 orchestrator (old reference: `apps/worker/src/trigger/reverse-email-batch.task.ts`
  — max 100, auto-halve, poll 1 min × 30, confidence ≥ 4 gate).
- **Live test:** 1-email batch → FINISHED with the correct person.

### 3. List-Unsubscribe headers — `EmailService.buildListUnsubscribeHeaders`
- **Where:** `apps/api/src/services/email.service.ts` · playground: Email page checkbox
  ("Attach List-Unsubscribe headers").
- **What it's for:** RFC 8058 one-click unsubscribe. Gmail/Yahoo **require** these for
  bulk senders — campaign sends (B4) must always attach them or deliverability tanks.
- **How it works:** pure function → three headers: `List-Unsubscribe:
  <APP_URL/unsubscribe/{token}>`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  `X-Entity-Ref-ID: {token}`. The token will be the Email row's `trackingToken` (B4);
  the playground uses a demo token. `EmailService.send()` already accepts `headers`, so
  B4 just merges these in. The `/unsubscribe/{token}` page itself is Phase F2/B4.
- **Live test:** sent (test mode) with headers attached and echoed in the response.

## Scheduled for a future phase (not yet implementable — needs tables/scheduler)

| Phase | What | Old-repo reference (exact path) | Why not now |
|---|---|---|---|
| B1 | Dedup logic: `domainKey()` normalization, shared-platform set, googleId → domain → name+city key waterfall, contact upsert | `apps/api/src/leads/leads.service.ts` | needs the Lead/Contact tables |
| B1 | LLM dedup as fuzzy fallback (`deduplicateLead`) | `packages/llm/src/index.ts` | plan dedups deterministically first; decide later if fuzzy is needed |
| B2 | Enrichment orchestration + batch auto-halving loop + `preparePdlQuery` / `validateEnrichmentResults` | `apps/worker/src/trigger/enrichment.task.ts`, `reverse-email-batch.task.ts` (spec: ENRICHMENT.md) | needs EnrichmentService + LeadCost ledger |
| B3 | Video render pipeline: dual path (studio template + scenes vs avatar+script), poll 30×30s, then download → R2 (NOT Mux) | `apps/worker/src/trigger/render-video.task.ts`, `test-video.task.ts` | needs Video table + R2 binding + cron worker |
| B4 | Resend webhooks: svix verify, event→status map, idempotency by externalId (catch P2002), hard-bounce/complaint → auto-suppress | `apps/api/src/webhooks/resend.controller.ts` | needs Email/EmailEvent tables |
| B4 | Send rate limiting (concurrency 2 ≈ Resend 2 req/s) + retry backoff | `apps/worker/src/trigger/send-outreach.task.ts` | needs campaign scheduler |
| B4 | Template `{{var}}` extraction/validation regexes, industry terminology overrides, `sanitizeLeadContext` prompt-injection scrubbing | `packages/workflows/src/index.ts` | needs Template rendering in the API (frontend renderer exists) |
| B5 | Funnel stage order + canonical event names | `packages/analytics/src/index.ts` | needs stats queries |
| later | Jambonz call-event webhook (HMAC-SHA256 raw-body verify, callCount/firstCallAt) | `apps/api/src/webhooks/jambonz.controller.ts` (also noted in TELEPHONY.md) | needs demo-call tracking decision |

## Confirmed safe to ignore

NestJS/Next.js/Trigger.dev/Turbo scaffolding · Better Auth + orgs/members/invitations ·
`packages/ui` (shadcn), `packages/types`, `packages/tasks`, `packages/auth`, `packages/db`
(schema informed the plan already; immutability triggers belong to dropped versioning) ·
`packages/mux` + `packages/storage` (plan: HeyGen → R2, no Mux) · Langfuse ·
A/B variants + prompt tables + avatar consent machinery · lead merge/erase ·
`scripts/db-fresh.js`, `infra/coolify/` docker-compose (old deployment) ·
`apps/web` (Next.js UI — feature parity confirmed against plan §7: leads, workflows,
templates, avatars, analytics, `/v/[token]` video page, `/unsubscribe`; nothing there
the plan misses).
