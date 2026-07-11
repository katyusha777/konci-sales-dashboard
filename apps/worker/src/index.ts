import { runExampleJob } from './jobs/example.job'

export default {
  async scheduled(controller, env, ctx) {
    switch (controller.cron) {
      // Daily at 02:00 UTC
      case '0 2 * * *':
        ctx.waitUntil(runExampleJob(env))
        break
    }
  },
} satisfies ExportedHandler<Env>
