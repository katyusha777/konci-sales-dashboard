# Frontend Guide (apps/frontend)

Nuxt 4 + **Nuxt UI v4** on Cloudflare Pages. Read alongside `.claude/PROJECT_PLAN.md`
(§7 lists the pages). Design goal: **clean, admin-like sales dashboard** — density over
decoration, responsive throughout.

## UI library — Nuxt UI only

Nuxt UI v4 (`@nuxt/ui`) includes the former Pro components for free: `UDashboardGroup /
UDashboardSidebar / UDashboardNavbar / UDashboardPanel`, `UTable` (sorting/pagination),
`UForm` (+ zod validation), `UModal`, `USlideover`, `UToast`, `UCommandPalette`,
`UFileUpload`, `USelectMenu`, `UInputDate`, `UBadge`, `UCard`, `UTabs`, `UPagination`,
`UStepper` — 125+ components on Tailwind CSS.

- **No PrimeVue.** Nuxt UI covers everything V1 needs. The one gap is charts — when the
  Phase 5 dashboard needs them, add ONE small lib (Unovis — used by Nuxt UI's own
  dashboard template) and nothing else.
- Theme via `app.config.ts` (`ui.colors.primary`, neutral gray base). Use Nuxt UI
  semantic colors (`primary/success/error/warning`) — no custom palette. Dark mode comes
  free with Nuxt UI; keep it enabled.

## Directory layout (bluegem-style: `src/` root, `src/app/` infra — `srcDir: 'src/'`)

```
apps/frontend/src/
├── app/              # Non-UI infrastructure, like bluegem's src/app/
│   ├── api/          # THE data layer (bluegem's Api/XxxApi/XxxAdapter collapsed into one)
│   │   ├── client.ts # $api fetch wrapper: envelope unwrap + ApiError (+ dummy() helper)
│   │   ├── leads.api.ts  # One module per domain: LeadsApi.list(filters), .get(id)…
│   │   ├── campaigns.api.ts, templates.api.ts, avatars.api.ts, stats.api.ts, auth.api.ts
│   ├── dummy-data/   # FRONTEND-FIRST phase: typed fixtures (leads.ts, campaigns.ts…).
│   │                 # api modules serve these until each backend phase swaps their
│   │                 # internals to $api — signatures/types never change, pages untouched.
│   └── types/        # One .d.ts per domain (lead.d.ts, campaign.d.ts…), barrel index.ts
├── components/
│   ├── ui/           # Small shared bits ONLY if Nuxt UI lacks them (StatCard, StatusBadge)
│   └── leads/ campaigns/ templates/ avatars/   # Domain components as they grow
├── composables/      # Sparingly — most logic lives in api modules or pages (useAuth lives here)
├── layouts/          # default.vue (dashboard shell), public.vue (video/unsubscribe/login)
├── pages/            # File-based routes per PROJECT_PLAN §7 (Nuxt-managed, stays at src root)
└── utils/            # formatDate, formatUsd, etc. (auto-imported)
```

Imports use `~/app/api/…`, `~/app/types`. Nuxt-managed folders (pages, layouts,
components, composables, middleware) must stay at the `src/` root — only infra goes in `src/app/`.

## API layer — one clean layer, typed end to end

The backend returns the `ApiResponse<T>` envelope (`{ success: true, data }` |
`{ success: false, message, info }`). The client unwraps it in exactly one place:

```ts
// app/api/client.ts
export class ApiError extends Error {
  constructor(message: string, public info: string | null = null, public status?: number) {
    super(message)
  }
}

export const $api = $fetch.create({
  onResponse({ response }) { /* envelope check lives here, not in every call */ },
})

// Every api module returns UNWRAPPED typed data or throws ApiError:
// app/api/leads.api.ts
export abstract class LeadsApi {
  static list(filters: ILeadFilters): Promise<IPaginated<ILead>> {
    return $api('/api/leads', { query: filters })
  }
  static get(id: string): Promise<ILeadDetail> {
    return $api(`/api/leads/${id}`)
  }
  static enrich(id: string): Promise<ILead> {
    return $api(`/api/leads/${id}/enrich`, { method: 'POST' })
  }
}
```

- **`/api` is proxied through Nuxt/Nitro** (dev: to `localhost:8787`; prod: route rule to
  the Worker URL via `API_PROXY_URL`). Frontend always calls its own origin — first-party
  session cookies, zero CORS.
- Types mirror the backend DTOs (`I` prefix interfaces, `T` prefix aliases, bluegem
  style). When drift becomes painful, promote shared types to a `packages/shared`
  workspace package — don't hand-copy a third time.

## Data fetching & state (Nuxt standards, not bluegem's)

- **Page data**: `useAsyncData('key', () => LeadsApi.list(filters))` in pages — SSR-safe,
  cached, no store involved. Mutations call the api module directly, then `refresh()`.
- **Pinia** only for real cross-page state (persistent filters, UI prefs, auth later).
  bluegem's store-per-domain-with-loadX-actions pattern does NOT carry over — that's what
  `useAsyncData` is for in Nuxt.
- **No SSR guards needed** (`import.meta.env.SSR` checks are a bluegem/ViteSSG artifact);
  Nuxt composables handle it.

## Error handling — toast-first, components assume success

1. `$api` throws `ApiError` (envelope `success: false` or HTTP failure) with the
   backend's `message`/`info`.
2. Mutations (button handlers) catch once: `useToast().add({ title: err.message,
   color: 'error' })`. Success paths toast green where feedback matters.
3. Reads don't catch — let `useAsyncData`'s `error` render an inline `<UAlert>` /
   empty state. No try/catch pyramids in components.

## Design language (admin dashboard)

- **Shell**: `UDashboardGroup` → collapsible `UDashboardSidebar` (nav: Dashboard, Leads,
  Campaigns, Templates, Avatars) + `UDashboardNavbar` (page title, primary action button,
  test-mode banner when `EMAIL_TEST_MODE` is on).
- **List pages**: filters row (USelectMenu/UInput) → `UTable` (server-side pagination,
  sortable columns) → row click opens detail. Bulk-select checkboxes for "Add to
  campaign" / "Enrich".
- **Detail/forms**: `USlideover` for quick edit/preview, full page for lead detail,
  `UModal` only for confirmations. `UForm` + zod schemas for validation.
- **Status everywhere as `UBadge`** with consistent colors: lead status, enrichment
  status, campaign status, email status. One `StatusBadge.vue` maps enum → color/label;
  never inline color logic.
- **Dashboard/stats**: `UCard` stat tiles (sent today/week, open %, click %, cost) —
  charts only in Phase 5.
- **Responsive**: sidebar collapses to drawer on mobile (Dashboard components handle
  it); tables get `overflow-x-auto` on small screens — keep column count modest instead
  of building parallel mobile card layouts.
- Public pages (`/v/[token]`, `/unsubscribe/[token]`, `/login`) use the `public` layout:
  no nav, centered card, Konci branding only.
- **Auth (PARKED, 2026-07-11)**: UniFi SSO is fully built on the API (`/api/auth/*`,
  sessions in DB) and `/login` still triggers it, but the frontend route guard was
  removed because the first login attempt failed — most likely the redirect URI
  `http://localhost:3000/api/auth/callback` isn't registered in the UniFi Identity OAuth
  app. Once registered and verified, re-create `src/middleware/auth.global.ts` (~15
  lines: skip public prefixes `/login`, `/v/`, `/unsubscribe`; hydrate `useAuth()` via
  `fetchUser()`; redirect to `/login` when null) and restore the user/logout footer in
  the default layout.

## Conventions

- `<script setup lang="ts">` everywhere; typed `defineProps`/`defineEmits`.
- Component names PascalCase, domain-prefixed (`LeadTable`, `CampaignStepEditor`).
- Styling: Tailwind utilities + Nuxt UI props. Scoped CSS only when utilities genuinely
  can't express it. No UnoCSS, no SCSS, no custom design-token files — Nuxt UI's theme
  system is the token source.
- Keep it minimal (standing rule): no i18n, no module/plugin system, no mock layer, no
  theme switcher beyond built-in dark mode — bluegem features that don't apply here.
