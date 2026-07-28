export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: true },
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },
  // bluegem-style layout: src/ is the source root, src/app/ holds the
  // non-UI infrastructure (api, types, dummy-data).
  srcDir: 'src/',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  icon: {
    // Default is /api/_nuxt_icon/**, which our /api proxy would forward to the Worker
    localApiEndpoint: '/__nuxt_icon',
  },
  components: [
    // Bare component names regardless of folder (StatusBadge, not UiStatusBadge)
    { path: '~/components', pathPrefix: false },
  ],
  nitro: {
    // Builds to dist/ — deploy with `wrangler pages deploy dist`
    preset: 'cloudflare_pages',
  },
  routeRules: {
    // Dashboard pages render client-side only: SSR data fetches can't forward the
    // session cookie ($api is plain $fetch), so a hard refresh rendered 401-empty
    // pages once auth went live. Public pages keep SSR (no auth needed there).
    '/**': { ssr: false },
    '/v/**': { ssr: true },
    '/unsubscribe/**': { ssr: true },
    // All /api calls go through Nuxt to the Hono Worker: first-party cookies, no CORS.
    // Prod builds set API_PROXY_URL to the deployed Worker URL.
    // redirect: 'manual' — the OIDC login/callback endpoints answer with 302s that the
    // BROWSER must follow (and their Set-Cookie must reach it); following them
    // server-side served UniFi's HTML from our origin and dropped the session cookie.
    '/api/**': {
      proxy: {
        to: `${process.env.API_PROXY_URL || 'http://localhost:8787'}/api/**`,
        fetchOptions: { redirect: 'manual' },
      },
    },
  },
})
