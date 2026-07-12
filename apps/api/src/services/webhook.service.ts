// Resend delivery webhook. Runs OUTSIDE the controller/action() pattern because it needs
// the RAW request body for signature verification (action() pre-parses JSON, consuming the
// stream). Verifies the Svix signature, maps the event to an EmailEvent, correlates to the
// Email by Resend's message id, dedupes by the Svix id, updates status, and suppresses the
// contact on hard bounce / complaint / unsubscribe.

import type { EmailEventType } from '../generated/prisma/client'
import type { createPrisma } from '../lib/prisma'
import { suppressContact } from '../lib/suppression'
import { verifyResendSignature } from '../lib/webhook-verify'

type PrismaClient = ReturnType<typeof createPrisma>

const EVENT_MAP: Record<string, EmailEventType> = {
  'email.delivered': 'DELIVERED',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.unsubscribed': 'UNSUBSCRIBED',
}

interface ResendPayload {
  type?: string
  created_at?: string
  data?: { email_id?: string }
}

export abstract class WebhookService {
  static async handleResend(prisma: PrismaClient, env: Env, rawBody: string, headers: { id: string | null, timestamp: string | null, signature: string | null }): Promise<Response> {
    const ok = await verifyResendSignature(env.RESEND_WEBHOOK_SECRET, rawBody, headers)
    if (!ok)
      return new Response('invalid signature', { status: 401 })

    let payload: ResendPayload
    try {
      payload = JSON.parse(rawBody)
    }
    catch {
      return new Response('bad payload', { status: 400 })
    }

    const type = payload.type ? EVENT_MAP[payload.type] : undefined
    const messageId = payload.data?.email_id
    if (!type || !messageId)
      return new Response('ignored', { status: 200 }) // unknown event / unrelated — ack

    const email = await prisma.email.findFirst({ where: { providerMessageId: messageId } })
    if (!email)
      return new Response('unknown message', { status: 200 })

    // Idempotency: the Svix id is unique per delivery; a retried webhook hits the unique
    // constraint on external_id and we ack as a duplicate.
    try {
      await prisma.emailEvent.create({
        data: {
          emailId: email.id,
          type,
          externalId: headers.id!,
          payload: payload as object,
          occurredAt: payload.created_at ? new Date(payload.created_at) : new Date(),
        },
      })
    }
    catch (err) {
      if ((err as { code?: string }).code === 'P2002')
        return new Response('duplicate', { status: 200 })
      throw err
    }

    // UNSUBSCRIBED is an event but not an Email delivery status — skip the status write for it.
    if (type !== 'UNSUBSCRIBED')
      await prisma.email.update({ where: { id: email.id }, data: { status: type } })

    if ((type === 'BOUNCED' || type === 'COMPLAINED' || type === 'UNSUBSCRIBED') && email.contactId)
      await suppressContact(prisma, email.contactId, type)

    return new Response('ok', { status: 200 })
  }
}
