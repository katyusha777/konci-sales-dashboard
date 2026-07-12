import type { Avatar } from '../generated/prisma/client'
import type { AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import { AvatarService } from '../services/avatar.service'

function serializeAvatar(a: Avatar) {
  return {
    id: a.id,
    name: a.name,
    heygenAvatarId: a.heygenAvatarId,
    voiceId: a.voiceId,
    previewImageUrl: a.previewImageUrl,
    isActive: a.isActive,
    lastSyncedAt: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
  }
}

export default class AvatarController extends Controller {
  private fail(status: 400 | 404 | 502, message: string, info: string | null = null): Response {
    return this.c.json({ success: false, message, info }, status)
  }

  // GET /api/avatars
  async index() {
    const avatars = await AvatarService.list(this.prisma)
    return this.data(avatars.map(serializeAvatar))
  }

  // POST /api/avatars/sync — pull custom avatars from HeyGen
  async sync() {
    try {
      const avatars = await AvatarService.sync(this.prisma, this.c.env)
      return this.data(avatars.map(serializeAvatar))
    }
    catch (err) {
      return this.fail(502, 'HeyGen avatar sync failed', (err as Error).message)
    }
  }

  // PATCH /api/avatars/:id — { isActive }
  async setActive(req: AppRequest<{ Params: { id: string }, Body: { isActive?: boolean } }>) {
    if (typeof req.body.isActive !== 'boolean')
      return this.fail(400, 'isActive (boolean) is required')
    try {
      const avatar = await AvatarService.setActive(this.prisma, req.params.id, req.body.isActive)
      return this.data(serializeAvatar(avatar))
    }
    catch {
      return this.fail(404, 'Avatar not found')
    }
  }
}
