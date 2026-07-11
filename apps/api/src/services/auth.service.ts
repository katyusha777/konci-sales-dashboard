import type { createPrisma } from '../lib/prisma'

type Prisma = ReturnType<typeof createPrisma>

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

const SESSION_TTL_DAYS = 30

let discoveryCache: OidcDiscovery | null = null

// UniFi Identity SSO — plain OIDC authorization-code flow, no auth framework.
export abstract class AuthService {
  static readonly SESSION_COOKIE = 'konci_session'

  static redirectUri(env: Env): string {
    return `${env.APP_URL}/api/auth/callback`
  }

  static async discovery(env: Env): Promise<OidcDiscovery> {
    if (discoveryCache)
      return discoveryCache
    const res = await fetch(env.UNIFI_DISCOVERY_URL)
    if (!res.ok)
      throw new Error(`OIDC discovery failed (${res.status})`)
    discoveryCache = await res.json<OidcDiscovery>()
    return discoveryCache
  }

  static async buildAuthorizeUrl(env: Env, state: string): Promise<string> {
    const { authorization_endpoint } = await this.discovery(env)
    const url = new URL(authorization_endpoint)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', env.UNIFI_CLIENT_ID)
    url.searchParams.set('redirect_uri', this.redirectUri(env))
    url.searchParams.set('scope', 'openid profile email')
    url.searchParams.set('state', state)
    return url.toString()
  }

  static async exchangeCode(env: Env, code: string): Promise<string> {
    const { token_endpoint } = await this.discovery(env)
    const res = await fetch(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(env),
        client_id: env.UNIFI_CLIENT_ID,
        client_secret: env.UNIFI_CLIENT_SECRET,
      }),
    })
    if (!res.ok)
      throw new Error(`OIDC token exchange failed (${res.status}): ${await res.text()}`)
    const body = await res.json<{ access_token?: string }>()
    if (!body.access_token)
      throw new Error('OIDC token exchange returned no access_token')
    return body.access_token
  }

  static async fetchUserinfo(env: Env, accessToken: string): Promise<{ sub: string, email: string, name: string | null }> {
    const { userinfo_endpoint } = await this.discovery(env)
    const res = await fetch(userinfo_endpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok)
      throw new Error(`OIDC userinfo failed (${res.status})`)
    const info = await res.json<{ sub: string, email?: string, name?: string, preferred_username?: string }>()
    if (!info.sub || !info.email)
      throw new Error('OIDC userinfo missing sub/email')
    return { sub: info.sub, email: info.email, name: info.name ?? info.preferred_username ?? null }
  }

  // Full callback handling: code -> tokens -> userinfo -> upsert user -> session.
  static async login(prisma: Prisma, env: Env, code: string): Promise<{ token: string, expiresAt: Date }> {
    const accessToken = await this.exchangeCode(env, code)
    const info = await this.fetchUserinfo(env, accessToken)

    const user = await prisma.user.upsert({
      where: { unifiSub: info.sub },
      update: { email: info.email, name: info.name },
      create: { unifiSub: info.sub, email: info.email, name: info.name },
    })

    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const token = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    await prisma.session.create({ data: { token, userId: user.id, expiresAt } })
    return { token, expiresAt }
  }

  static async validateSession(prisma: Prisma, token: string): Promise<AuthUser | null> {
    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
    if (!session || session.expiresAt < new Date())
      return null
    return { id: session.user.id, email: session.user.email, name: session.user.name }
  }

  static async destroySession(prisma: Prisma, token: string): Promise<void> {
    await prisma.session.deleteMany({ where: { token } })
  }
}
