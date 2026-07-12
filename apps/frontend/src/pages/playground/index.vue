<script setup lang="ts">
import { PlaygroundApi } from '~/app/api/playground.api'

// Live email config doubles as an "is the API up + env sane" check.
const { data: emailConfig, error: emailError } = await useAsyncData('playground.emailConfig', () => PlaygroundApi.emailConfig())

// status: live API test results, 2026-07-12 (✅ working · ⚠️ partial · 🚫 blocked)
const services = [
  { name: 'Scrap.io', to: '/playground/scrapio', icon: 'i-lucide-map-pin', description: 'Search Google Maps business data — the lead source.', status: '🚫', statusNote: 'API returns 403 — the current Scrap.io subscription has no API access. Upgrade the plan at app.scrap.io.' },
  { name: 'Google Places', to: '/playground/google-places', icon: 'i-lucide-map', description: 'Verified business data — rating, hours, canonical website.', status: '✅' },
  { name: 'Firecrawl', to: '/playground/firecrawl', icon: 'i-lucide-globe', description: 'Scrape the business\'s own website — staff, services, hours.', status: '✅' },
  { name: 'OpenRouter', to: '/playground/openrouter', icon: 'i-lucide-sparkles', description: 'LLM extraction — scraped markdown → facts, services, staff.', status: '✅' },
  { name: 'Apollo', to: '/playground/apollo', icon: 'i-lucide-user-search', description: 'Contact enrichment — find a decision-maker\'s work email.', status: '⚠️', statusNote: 'Company enrich works; person match is 403 on the free Apollo plan.' },
  { name: 'PDL', to: '/playground/pdl', icon: 'i-lucide-contact-round', description: 'Primary contact data — company enrich, people search, person enrich.', status: '✅' },
  { name: 'Hunter', to: '/playground/hunter', icon: 'i-lucide-at-sign', description: 'Cheap email finder — name + domain → email, charged only on match.', status: '✅' },
  { name: 'FullEnrich', to: '/playground/fullenrich', icon: 'i-lucide-layers', description: 'Waterfall aggregator — expensive last resort for contacts.', status: '✅' },
  { name: 'HeyGen', to: '/playground/heygen', icon: 'i-lucide-video', description: 'Avatars, voices, studio templates, video generation.', status: '✅' },
  { name: 'Email', to: '/playground/email', icon: 'i-lucide-mail', description: 'Send a test email through Resend (test-mode enforced).', status: '✅' },
  { name: 'Jambonz', to: '/playground/jambonz', icon: 'i-lucide-phone-call', description: 'Telephony — demo phone numbers + PINs from Konci\'s own server.', status: '⚠️', statusNote: 'Pool/agent lists verified. Provision/release endpoints untested — they take a real number from the production pool; test deliberately from the page.' },
]
</script>

<template>
  <UDashboardPanel id="playground">
    <template #header>
      <UDashboardNavbar title="Playground" />
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-3xl">
        <p class="text-sm text-muted">
          One place to live-test every third-party service this system depends on.
          These pages hit the <b>real</b> providers through the API — the rest of the
          dashboard still runs on dummy data until each backend phase lands.
        </p>

        <UAlert
          v-if="emailError"
          color="error" variant="subtle" icon="i-lucide-server-off"
          title="API not reachable"
          :description="`Is the API running? (pnpm dev:api) — ${emailError.message}`"
        />
        <UAlert
          v-else-if="emailConfig"
          :color="emailConfig.testMode ? 'warning' : 'error'" variant="subtle" icon="i-lucide-flask-conical"
          :title="emailConfig.testMode ? `Email test mode is ON — everything goes to ${emailConfig.testRecipient}` : 'Email test mode is OFF — emails go to REAL recipients'"
          :description="`Sending from: ${emailConfig.from}`"
        />

        <div class="grid sm:grid-cols-2 gap-4">
          <UCard
            v-for="s in services" :key="s.to"
            class="hover:ring-2 hover:ring-primary/50 transition cursor-pointer"
            @click="navigateTo(s.to)"
          >
            <div class="flex items-start gap-3">
              <UIcon :name="s.icon" class="size-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p class="font-medium">
                  {{ s.name }} <span class="ms-1">{{ s.status }}</span>
                </p>
                <p class="text-sm text-muted mt-1">
                  {{ s.description }}
                </p>
                <p v-if="s.statusNote" class="text-xs text-warning mt-1.5">
                  {{ s.statusNote }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
