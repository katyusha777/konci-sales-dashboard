// Suppress a contact everywhere at once: set its email status and cancel any of its
// pending/scheduled campaign sends. Called by the Resend webhook (hard bounce / complaint /
// unsubscribe) and the unsubscribe endpoint, so the write happens in exactly one place.

import type { ContactEmailStatus } from '../generated/prisma/client'
import type { createPrisma } from './prisma'

type PrismaClient = ReturnType<typeof createPrisma>

export async function suppressContact(prisma: PrismaClient, contactId: string, emailStatus: Extract<ContactEmailStatus, 'BOUNCED' | 'UNSUBSCRIBED' | 'COMPLAINED'>) {
  await prisma.contact.update({ where: { id: contactId }, data: { emailStatus } })
  await prisma.campaignLead.updateMany({
    where: { contactId, status: { in: ['PENDING', 'SCHEDULED'] } },
    data: { status: 'SUPPRESSED' },
  })
}
