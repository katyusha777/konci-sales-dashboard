import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../lib/context'
import { AuthService } from '../services/auth.service'

// Paths that skip session auth: the auth flow itself, health checks, and
// (later) public tracking/webhook/video routes.
const PUBLIC_PREFIXES = ['/api/auth', '/api/health']

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // UniFi SSO is parked (see plan §9.1) — AUTH_DISABLED=true skips session checks.
  // Remove the flag once the redirect URI is registered and login works.
  if (c.env.AUTH_DISABLED === 'true')
    return next()

  if (PUBLIC_PREFIXES.some(p => c.req.path.startsWith(p)))
    return next()

  const token = getCookie(c, AuthService.SESSION_COOKIE)
  const user = token ? await AuthService.validateSession(c.var.prisma, token) : null
  if (!user)
    return c.json({ success: false, message: 'Unauthenticated', info: null }, 401)

  c.set('user', user)
  await next()
})
