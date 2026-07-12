<script setup lang="ts">
import type { IFirecrawlLiveResult } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const url = ref('')
const loading = ref(false)
const result = ref<IFirecrawlLiveResult | null>(null)
const error = ref<ApiError | null>(null)

const samples = [
  { label: 'Restaurant site', apply: () => url.value = 'https://franklinbarbecue.com' },
  { label: 'Squire booking flow', apply: () => url.value = 'https://getsquire.com/booking/brands/ninevehbarbershop' },
  { label: 'Corporate site', apply: () => url.value = 'https://stripe.com' },
]

async function scrape(target?: string) {
  if (target)
    url.value = target
  loading.value = true
  error.value = null
  selectedPages.value = null
  try {
    result.value = await PlaygroundApi.firecrawlScrape(url.value.trim())
  }
  catch (err) {
    error.value = err as ApiError
  }
  finally {
    loading.value = false
  }
}

// Step 2 of the real flow: let the LLM pick which of the scraped links to scrape next.
const selecting = ref(false)
const selectedPages = ref<Array<string> | null>(null)
const selectError = ref<ApiError | null>(null)

async function selectPages() {
  if (!result.value)
    return
  selecting.value = true
  selectError.value = null
  try {
    selectedPages.value = await PlaygroundApi.openrouterSelectPages({
      baseUrl: result.value.url,
      links: result.value.links,
      maxPages: 5,
    })
  }
  catch (err) {
    selectError.value = err as ApiError
  }
  finally {
    selecting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-firecrawl">
    <template #header>
      <UDashboardNavbar title="Playground — Firecrawl">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid lg:grid-cols-[18rem_1fr] gap-6">
        <!-- Left: input -->
        <div class="flex flex-col gap-3">
          <SampleChips :samples="samples" />
          <UFormField label="Website URL" help="Booking platforms handled automatically.">
            <UInput v-model="url" placeholder="https://lonestardental.com" class="w-full" @keydown.enter="url.trim() && scrape()" />
          </UFormField>
          <UButton icon="i-lucide-globe" label="Scrape live" block :loading="loading" :disabled="!url.trim()" @click="scrape()" />
          <p class="text-xs text-dimmed">
            Live call — ~$0.001 per page. Booking-flow URLs (/book, /cart…) are resolved
            to the profile page; garbage pages (bot walls, empty carts) throw.
          </p>
          <p class="text-xs text-dimmed">
            To see the extraction step, copy the markdown into the
            <NuxtLink to="/playground/openrouter" class="text-primary">
              OpenRouter page
            </NuxtLink> — or scrape directly from there.
          </p>
        </div>

        <!-- Right: results -->
        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <template v-if="result">
            <div class="flex items-center gap-2 flex-wrap text-sm">
              <span class="font-medium">{{ result.title ?? result.url }}</span>
              <UBadge v-if="result.isBookingPlatform" color="warning" variant="subtle" size="sm">
                booking platform
              </UBadge>
              <span class="text-xs text-muted ms-auto">{{ result.markdown.length.toLocaleString() }} chars · {{ result.links.length }} links</span>
            </div>
            <div v-if="result.description" class="text-xs text-muted">
              {{ result.description }}
            </div>

            <details class="border border-default rounded-lg" open>
              <summary class="px-3 py-2 text-xs text-muted cursor-pointer select-none">
                Markdown
              </summary>
              <pre class="text-xs p-3 pt-0 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">{{ result.markdown }}</pre>
            </details>

            <!-- Step 2: LLM page selection -->
            <div class="flex items-center gap-2">
              <UButton icon="i-lucide-sparkles" variant="outline" color="neutral" label="Pick subpages with LLM" :loading="selecting" :disabled="result.links.length === 0" @click="selectPages" />
              <span class="text-xs text-dimmed">next step of the flow — OpenRouter picks staff/services/about pages (~$0.002)</span>
            </div>
            <UAlert v-if="selectError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="selectError.message" :description="selectError.info ?? undefined" />
            <div v-if="selectedPages" class="border border-default rounded-lg divide-y divide-default">
              <div v-if="selectedPages.length === 0" class="p-3 text-sm text-muted">
                LLM found no subpages worth scraping.
              </div>
              <div v-for="page in selectedPages" :key="page" class="p-3 flex items-center gap-2">
                <span class="text-sm truncate">{{ page }}</span>
                <UButton size="xs" variant="outline" color="neutral" label="Scrape this" class="ms-auto shrink-0" :loading="loading" @click="scrape(page)" />
              </div>
            </div>

            <RawJson :data="{ url: result.url, title: result.title, isBookingPlatform: result.isBookingPlatform, links: result.links, raw: result.raw }" label="Links + metadata JSON" />
          </template>

          <div v-else-if="!error" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
            Scrape a business website — markdown, links, and the LLM subpage selection appear here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
