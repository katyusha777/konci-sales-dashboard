// RETIRED — the scheduler moved into the api Worker (apps/api/src/scheduler.ts), which now
// exports both `fetch` and `scheduled`. This Worker has no cron and does nothing; it stays
// only so an existing `konci-worker` deployment isn't orphaned. Safe to delete once that
// deployment is torn down.
export default {
  async scheduled() {
    // no-op
  },
} satisfies ExportedHandler<Env>
