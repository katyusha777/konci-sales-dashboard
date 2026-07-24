# Integration between the Dashboard and the Konci platform

> **Superseded 2026-07-23** — the leads API shipped and is integrated. See
> `.claude/smartlead-integration.md` §9 for the implemented flow
> (`KonciService`, `KonciRegistrationService`, `konci_registrations` table,
> cron auto-register for list members, hard gate before Smartlead sync).

Remaining ideas from the original notes, still open:

- Events table ('call', 'email_click', 'email_open') — partially covered by the
  S5 stats mirror plan (provider_email_stats); call events TBD with Konci.
- lead_calls table (calls of the lead, links to recordings, sentiment) — TBD,
  needs a Konci API for call data.
