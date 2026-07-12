import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import { suppressContact } from '../lib/suppression'

// PUBLIC. Resolves an Email by its trackingToken (the {{unsubscribe_url}} / List-Unsubscribe
// token) and unsubscribes the contact. Idempotent: re-hitting it is a no-op that still 200s.
export default class UnsubscribeController extends Controller {
  // POST /api/unsubscribe/:token
  async unsubscribe(req: AppRequest<{ Params: { token: string } }>) {
    const email = await this.prisma.email.findUnique({ where: { trackingToken: req.params.token } })
    if (!email || !email.contactId)
      return this.data({ ok: true }) // don't reveal token validity; always succeed

    await suppressContact(this.prisma, email.contactId, 'UNSUBSCRIBED')
    // Record an idempotent UNSUBSCRIBED event (unique externalId prevents duplicates)
    await this.prisma.emailEvent.create({
      data: { emailId: email.id, type: 'UNSUBSCRIBED', externalId: `unsub:${req.params.token}`, occurredAt: new Date() },
    }).catch(() => {})

    return this.data({ ok: true })
  }
}
