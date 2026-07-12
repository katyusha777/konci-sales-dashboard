import type { IAvatar } from '~/app/types'
import { $api } from './client'

export abstract class AvatarsApi {
  static list(): Promise<Array<IAvatar>> {
    return $api('/api/avatars')
  }

  static setActive(id: string, isActive: boolean): Promise<IAvatar> {
    return $api(`/api/avatars/${id}`, { method: 'PATCH', body: { isActive } })
  }

  static sync(): Promise<Array<IAvatar>> {
    return $api('/api/avatars/sync', { method: 'POST' })
  }
}
