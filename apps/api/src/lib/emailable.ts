// The single source of truth for "may we email this contact?" — reused by campaign
// enrollment, the send tick, and the webhook/unsubscribe suppression writes so the rule
// can't drift. A contact is emailable when it has an address and hasn't bounced,
// unsubscribed, or complained.

import type { ContactEmailStatus } from '../generated/prisma/client'

const BLOCKED: ReadonlyArray<ContactEmailStatus> = ['BOUNCED', 'UNSUBSCRIBED', 'COMPLAINED']

export function isEmailableStatus(status: ContactEmailStatus): boolean {
  return !BLOCKED.includes(status)
}

export function isEmailable(contact: { email: string | null, emailStatus: ContactEmailStatus }): boolean {
  return !!contact.email && isEmailableStatus(contact.emailStatus)
}
