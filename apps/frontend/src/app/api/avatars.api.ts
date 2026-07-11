import type { IAvatar } from '~/app/types'
import { dummyAvatars } from '~/app/dummy-data/avatars'
import { dummy } from './client'

// DUMMY-BACKED (frontend-first phase).
export abstract class AvatarsApi {
  static list(): Promise<Array<IAvatar>> {
    return dummy(dummyAvatars)
  }

  static async setActive(id: string, isActive: boolean): Promise<IAvatar> {
    const avatar = dummyAvatars.find(a => a.id === id)
    if (avatar)
      avatar.isActive = isActive
    return dummy(avatar!, 150)
  }

  static async sync(): Promise<Array<IAvatar>> {
    dummyAvatars.forEach(a => a.lastSyncedAt = new Date().toISOString())
    return dummy(dummyAvatars, 1000)
  }
}
