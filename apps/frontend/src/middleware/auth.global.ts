// Route guard for UniFi SSO (plan §9.1). Client-only: $api doesn't forward cookies
// during SSR, so the server render passes through and the client redirects.
const PUBLIC = [/^\/login/, /^\/v\//, /^\/unsubscribe\//]

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || PUBLIC.some(r => r.test(to.path)))
    return

  const { user, fetchUser } = useAuth()
  if (user.value === undefined)
    await fetchUser()
  // null = confirmed 401. undefined = couldn't check (transient error) — fail open;
  // real API calls still 401 and the next navigation retries.
  if (user.value === null)
    return navigateTo('/login')
})
