import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { ApiData, ApiMessage, AppRequest } from '../lib/controller'
import { Controller } from '../lib/controller'
import type { AuthUser } from '../services/auth.service'
import { AuthService } from '../services/auth.service'

const STATE_COOKIE = 'oidc_state'

export default class AuthController extends Controller {
  private get secure(): boolean {
    return this.c.env.APP_URL.startsWith('https')
  }

  // GET /api/auth/login — kick off the UniFi OIDC flow
  async login(): Promise<Response> {
    const state = crypto.randomUUID()
    setCookie(this.c, STATE_COOKIE, state, { httpOnly: true, path: '/', maxAge: 600, sameSite: 'Lax', secure: this.secure })
    return this.c.redirect(await AuthService.buildAuthorizeUrl(this.c.env, state))
  }

  // GET /api/auth/callback — UniFi redirects here with ?code&state
  async callback(req: AppRequest<{ Query: { code?: string, state?: string } }>): Promise<Response> {
    const { code, state } = req.query
    const savedState = getCookie(this.c, STATE_COOKIE)
    deleteCookie(this.c, STATE_COOKIE, { path: '/' })

    if (!code || !state || state !== savedState)
      return this.c.redirect(`${this.c.env.APP_URL}/login?error=oidc`)

    try {
      const session = await AuthService.login(this.prisma, this.c.env, code)
      setCookie(this.c, AuthService.SESSION_COOKIE, session.token, {
        httpOnly: true,
        path: '/',
        expires: session.expiresAt,
        sameSite: 'Lax',
        secure: this.secure,
      })
      return this.c.redirect(this.c.env.APP_URL)
    }
    catch (err) {
      console.error('OIDC callback failed:', err)
      return this.c.redirect(`${this.c.env.APP_URL}/login?error=oidc`)
    }
  }

  // GET /api/auth/me — current user (session checked here: /api/auth/* skips authMiddleware)
  async me(): Promise<Response | ApiData<AuthUser>> {
    const token = getCookie(this.c, AuthService.SESSION_COOKIE)
    const user = token ? await AuthService.validateSession(this.prisma, token) : null
    if (!user)
      return this.c.json({ success: false, message: 'Unauthenticated', info: null }, 401)
    return this.data(user)
  }

  // POST /api/auth/logout
  async logout(): Promise<ApiMessage> {
    const token = getCookie(this.c, AuthService.SESSION_COOKIE)
    if (token)
      await AuthService.destroySession(this.prisma, token)
    deleteCookie(this.c, AuthService.SESSION_COOKIE, { path: '/' })
    return this.success('Logged out')
  }
}
