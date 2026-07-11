export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: true },
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
    // All /api calls go through Nuxt to the Hono Worker: first-party cookies, no CORS.
    // Prod builds set API_PROXY_URL to the deployed Worker URL.
    '/api/**': { proxy: `${process.env.API_PROXY_URL || 'http://localhost:8787'}/api/**` },
  },
})
