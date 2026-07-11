import type { IAuthUser } from '~/app/types'
import { AuthApi } from '~/app/api/auth.api'

// undefined = not checked yet, null = checked & not logged in
export function useAuth() {
  const user = useState<IAuthUser | null | undefined>('auth.user', () => undefined)

  async function fetchUser(): Promise<void> {
    try {
      user.value = await AuthApi.me()
    }
    catch {
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
