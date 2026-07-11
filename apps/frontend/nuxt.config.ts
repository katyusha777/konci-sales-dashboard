export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: true },
  nitro: {
    // Builds to dist/ — deploy with `wrangler pages deploy dist`
    preset: 'cloudflare_pages',
  },
})
