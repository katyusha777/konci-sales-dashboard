<script setup lang="ts">
import type { IOpenrouterLiveExtract } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const form = reactive({
  businessName: '',
  businessContext: '',
  markdown: '',
})

// Convenience: fetch the markdown straight from Firecrawl so the full
// scrape → extract chain can be exercised from this one page.
const scrapeUrl = ref('')
const scraping = ref(false)
const scrapeError = ref<ApiError | null>(null)

async function scrapeFirst() {
  scraping.value = true
  scrapeError.value = null
  try {
    const res = await PlaygroundApi.firecrawlScrape(scrapeUrl.value.trim())
    form.markdown = res.markdown
    if (!form.businessName && res.title)
      form.businessName = res.title
  }
  catch (err) {
    scrapeError.value = err as ApiError
  }
  finally {
    scraping.value = false
  }
}

const loading = ref(false)
const result = ref<IOpenrouterLiveExtract | null>(null)
const error = ref<ApiError | null>(null)

async function extract() {
  loading.value = true
  error.value = null
  try {
    result.value = await PlaygroundApi.openrouterExtract({
      markdown: form.markdown,
      businessName: form.businessName.trim(),
      businessContext: form.businessContext.trim() || undefined,
    })
  }
  catch (err) {
    error.value = err as ApiError
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-openrouter">
    <template #header>
      <UDashboardNavbar title="Playground — OpenRouter (LLM extraction)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Left: input -->
        <div class="flex flex-col gap-3">
          <UCard>
            <template #header>
              <span class="font-medium">1 · Get markdown <span class="text-xs text-muted font-normal">(paste, or scrape via Firecrawl)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <div class="flex gap-2">
                <UInput v-model="scrapeUrl" placeholder="https://lonestardental.com" class="flex-1" @keydown.enter="scrapeUrl.trim() && scrapeFirst()" />
                <UButton icon="i-lucide-globe" variant="outline" color="neutral" label="Scrape" :loading="scraping" :disabled="!scrapeUrl.trim()" @click="scrapeFirst" />
              </div>
              <UAlert v-if="scrapeError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="scrapeError.message" :description="scrapeError.info ?? undefined" />
              <UFormField label="Website markdown" :hint="form.markdown ? `${form.markdown.length.toLocaleString()} chars (capped at 20k for the LLM)` : undefined">
                <UTextarea v-model="form.markdown" :rows="10" class="w-full font-mono text-xs" placeholder="Scraped website content…" />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <span class="font-medium">2 · Extract signals</span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Business name" hint="the target business the content should be about">
                <UInput v-model="form.businessName" placeholder="Lonestar Dental Care" class="w-full" />
              </UFormField>
              <UFormField label="Extraction context" hint="optional — narrows extraction on mixed/platform pages">
                <UInput v-model="form.businessContext" placeholder="A dental clinic in Austin TX, ignore platform content" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-sparkles" label="Extract live" :loading="loading" :disabled="!form.markdown.trim() || !form.businessName.trim()" class="self-start" @click="extract" />
              <p class="text-xs text-dimmed">
                Live call — ~$0.002 per extraction (Llama 4 Maverick via OpenRouter).
              </p>
            </div>
          </UCard>
        </div>

        <!-- Right: results -->
        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <template v-if="result">
            <UAlert
              v-if="!result.contentIsRelevant"
              color="warning" variant="subtle" icon="i-lucide-shield-alert"
              title="Content flagged as NOT about the target business"
              :description="result.contentRelevanceReason ?? undefined"
            />

            <UCard>
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2 flex-wrap">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ result.canonicalName ?? form.businessName }}</span>
                  <UBadge v-if="result.industry" color="neutral" variant="outline" size="sm">
                    {{ result.industry }}
                  </UBadge>
                  <UBadge v-if="result.canonicalDomain" color="warning" variant="subtle" size="sm">
                    real domain: {{ result.canonicalDomain }}
                  </UBadge>
                </div>
                <div v-if="result.summary"><span class="text-muted text-xs block">Summary</span>{{ result.summary }}</div>
                <div v-if="result.primaryService"><span class="text-muted text-xs block">Primary service</span>{{ result.primaryService }}</div>
                <div v-if="result.services.length" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-muted text-xs w-full">Services</span>
                  <UBadge v-for="s in result.services" :key="s" color="neutral" variant="outline" size="sm">
                    {{ s }}
                  </UBadge>
                </div>
                <div v-if="result.businessHours">
                  <span class="text-muted text-xs block">Hours</span>
                  <div class="text-xs">
                    <div v-for="(hours, day) in result.businessHours" :key="day">
                      <span class="capitalize">{{ day }}</span>: {{ hours }}
                    </div>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard v-if="result.discoveredContacts.length">
              <template #header>
                <span class="font-medium text-sm">Discovered contacts <span class="text-xs text-muted font-normal">— these feed the contact waterfall</span></span>
              </template>
              <div class="divide-y divide-default -my-2">
                <div v-for="(c, i) in result.discoveredContacts" :key="i" class="py-2 text-sm flex items-center gap-2 flex-wrap">
                  <span class="font-medium">{{ [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)' }}</span>
                  <UBadge v-if="c.jobTitle" color="neutral" variant="outline" size="sm">
                    {{ c.jobTitle }}
                  </UBadge>
                  <span class="text-xs text-muted ms-auto">{{ c.email ?? 'no email' }}</span>
                </div>
              </div>
            </UCard>

            <UCard v-if="result.facts.length">
              <template #header>
                <span class="font-medium text-sm">Facts ({{ result.facts.length }})</span>
              </template>
              <div class="divide-y divide-default -my-2">
                <div v-for="(f, i) in result.facts" :key="i" class="py-2 text-sm flex items-start gap-2">
                  <UBadge color="neutral" variant="outline" size="sm" class="shrink-0">
                    {{ f.key }}
                  </UBadge>
                  <span class="flex-1">{{ f.value }}</span>
                  <span class="text-xs text-muted shrink-0">{{ Math.round(f.confidence * 100) }}%</span>
                </div>
              </div>
            </UCard>

            <RawJson :data="result.raw" />
          </template>

          <div v-else-if="!error" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
            Scrape or paste website content, then extract — facts, services, and staff appear here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
