import type { IAuthUser } from '~/app/types'
import { $api } from './client'

// The only REAL api module during the frontend-first phase (SSO can't be dummied).
export abstract class AuthApi {
  static me(): Promise<IAuthUser> {
    return $api('/api/auth/me')
  }

  static logout(): Promise<void> {
    return $api('/api/auth/logout', { method: 'POST' })
  }
}
