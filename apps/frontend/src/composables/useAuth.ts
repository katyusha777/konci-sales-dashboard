import type { IAuthUser } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { AuthApi } from '~/app/api/auth.api'

// undefined = not checked yet, null = checked & not logged in
export function useAuth() {
  const user = useState<IAuthUser | null | undefined>('auth.user', () => undefined)

  async function fetchUser(): Promise<void> {
    try {
      user.value = await AuthApi.me()
    }
    catch (err) {
      // Only a real 401 means logged out. A transient failure (API rebuilding in
      // dev, network blip) must NOT bounce a valid 30-day session to /login.
      if (err instanceof ApiError && err.status === 401)
        user.value = null
    }
  }

  async function logout(): Promise<void> {
    try {
      await AuthApi.logout()
    }
    finally {
      user.value = null
      await navigateTo('/login')
    }
  }

  return { user, fetchUser, logout }
}
