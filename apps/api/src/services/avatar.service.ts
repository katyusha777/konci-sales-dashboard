// Avatars — presenters for HeyGen videos. Created/trained in HeyGen studio; synced here
// so the owner can pick a default voice and activate/deactivate them for template use.

import type { createPrisma } from '../lib/prisma'
import { HeygenService } from './heygen.service'

type PrismaClient = ReturnType<typeof createPrisma>

export abstract class AvatarService {
  static list(prisma: PrismaClient) {
    return prisma.avatar.findMany({ orderBy: { createdAt: 'asc' } })
  }

  /**
   * Pull custom avatars from HeyGen and upsert by heygenAvatarId. Refreshes name +
   * preview + lastSyncedAt; never overwrites the owner-set voiceId / isActive. Avatars
   * that disappear from HeyGen are left in place (not deleted) — a template may reference them.
   */
  static async sync(prisma: PrismaClient, env: Env) {
    const remote = await HeygenService.listAvatars(env, true)
    const now = new Date()
    for (const a of remote) {
      const existing = await prisma.avatar.findFirst({ where: { heygenAvatarId: a.avatarId } })
      if (existing) {
        await prisma.avatar.update({
          where: { id: existing.id },
          data: { name: a.name, previewImageUrl: a.previewImageUrl, lastSyncedAt: now },
        })
      }
      else {
        await prisma.avatar.create({
          data: { name: a.name, heygenAvatarId: a.avatarId, previewImageUrl: a.previewImageUrl, lastSyncedAt: now },
        })
      }
    }
    return this.list(prisma)
  }

  static setActive(prisma: PrismaClient, id: string, isActive: boolean) {
    return prisma.avatar.update({ where: { id }, data: { isActive } })
  }
}
