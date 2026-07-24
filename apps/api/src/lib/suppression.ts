// Suppress a contact: set its email status. Called by the unsubscribe endpoint, so
// the write happens in exactly one place. (Resend + internal campaign machinery were
// removed — Smartlead owns sending and manages its own suppression.)

import type { ContactEmailStatus } from '../generated/prisma/client'
import type { createPrisma } from './prisma'

type PrismaClient = ReturnType<typeof createPrisma>

export async function suppressContact(prisma: PrismaClient, contactId: string, emailStatus: Extract<ContactEmailStatus, 'BOUNCED' | 'UNSUBSCRIBED' | 'COMPLAINED'>) {
  await prisma.contact.update({ where: { id: contactId }, data: { emailStatus } })
}
