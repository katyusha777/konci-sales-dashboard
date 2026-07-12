import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { WebhookService } from '../services/webhook.service'

// PUBLIC (see auth.middleware PUBLIC_PREFIXES). Bound as a plain handler — NOT via
// action() — because signature verification needs the raw, unparsed body.
export const webhooksRoutes = new Hono<AppEnv>()

webhooksRoutes.post('/resend', async (c) => {
  const rawBody = await c.req.text()
  return WebhookService.handleResend(c.var.prisma, c.env, rawBody, {
    id: c.req.header('svix-id') ?? null,
    timestamp: c.req.header('svix-timestamp') ?? null,
    signature: c.req.header('svix-signature') ?? null,
  })
})
