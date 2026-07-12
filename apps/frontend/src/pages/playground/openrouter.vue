<script setup lang="ts">
import type { IOpenrouterLiveExtract } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const form = reactive({
  businessName: '',
  businessContext: '',
  markdown: '',
})

// Free to test with — no scrape needed, extraction still costs ~$0.002.
const SAMPLE_MARKDOWN = `# Franklin Barbecue
Serving the best barbecue in Austin, TX since 2009. Founded by Aaron Franklin.
Open Tuesday-Sunday 11am-3pm. We offer brisket, ribs, pulled pork, turkey and sausage.
Contact: aaron@franklinbbq.com. Our pitmaster team: Aaron Franklin (owner), Braun Hughes (head pitmaster).`

const samples = [
  { label: 'Sample markdown (no scrape)', apply: () => Object.assign(form, { markdown: SAMPLE_MARKDOWN, businessName: 'Franklin Barbecue', businessContext: '' }) },
  { label: 'Scrape Franklin Barbecue', apply: () => {
    scrapeUrl.value = 'https://franklinbarbecue.com'
    form.businessName = 'Franklin Barbecue'
  } },
  { label: 'Scrape Squire barbershop', apply: () => {
    scrapeUrl.value = 'https://getsquire.com/booking/brands/ninevehbarbershop'
    Object.assign(form, { businessName: 'Nineveh Barbershop', businessContext: 'A barbershop — ignore Squire platform content' })
  } },
]

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

// ── CSV header mapping (validates the Phase B1 import flow) ──
const csvText = ref('')
const csvLoading = ref(false)
const csvMapping = ref<Record<string, string | null> | null>(null)
const csvError = ref<ApiError | null>(null)

const CSV_SAMPLE = `Business Name,Web Site,Phone Number,E-mail,Town,ST,Zip,Owner First,Owner Last,Owner Role,Stars,Nr Reviews
Franklin Barbecue,franklinbbq.com,(512) 653-1187,info@franklinbbq.com,Austin,TX,78702,Aaron,Franklin,Owner,4.7,7221
Voodoo Doughnut,voodoodoughnut.com,(503) 241-4704,hello@voodoodoughnut.com,Portland,OR,97205,Kenneth,Pogson,Co-founder,4.5,15230`

const csvSamples = [
  { label: 'Sample messy CSV', apply: () => csvText.value = CSV_SAMPLE },
]

// Naive comma-split is fine for the playground — the real B1 importer needs proper CSV parsing (quoted fields).
function parseCsv(text: string): { headers: Array<string>, sampleRows: Array<Record<string, string>> } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const headers = (lines[0] ?? '').split(',').map(h => h.trim())
  const sampleRows = lines.slice(1, 4).map((line) => {
    const cells = line.split(',').map(c => c.trim())
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
  })
  return { headers, sampleRows }
}

async function mapCsv() {
  csvLoading.value = true
  csvError.value = null
  try {
    csvMapping.value = await PlaygroundApi.openrouterMapCsv(parseCsv(csvText.value))
  }
  catch (err) {
    csvError.value = err as ApiError
  }
  finally {
    csvLoading.value = false
  }
}

const mappedEntries = computed(() => csvMapping.value ? Object.entries(csvMapping.value).filter(([, v]) => v) : [])
const unmappedFields = computed(() => csvMapping.value ? Object.entries(csvMapping.value).filter(([, v]) => !v).map(([k]) => k) : [])
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
              <SampleChips :samples="samples" />
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

          <div v-else-if="!error" class="text-sm text-muted py-12 text-center rounded-xl bg-default shadow-sm">
            Scrape or paste website content, then extract — facts, services, and staff appear here.
          </div>
        </div>
      </div>

      <USeparator class="my-6" />

      <!-- CSV header mapping -->
      <div class="grid lg:grid-cols-2 gap-6">
        <UCard>
          <template #header>
            <span class="font-medium">CSV header mapping <span class="text-xs text-muted font-normal">(powers the Phase B1 lead import)</span></span>
          </template>
          <div class="flex flex-col gap-3">
            <SampleChips :samples="csvSamples" />
            <UFormField label="Paste CSV" help="Header row + a few data rows. Simple comma-split here — the real importer will handle quoting.">
              <UTextarea v-model="csvText" :rows="6" class="w-full font-mono text-xs" placeholder="Business Name,Web Site,Phone Number,…" />
            </UFormField>
            <UButton icon="i-lucide-table-properties" label="Map columns live" :loading="csvLoading" :disabled="!csvText.trim()" class="self-start" @click="mapCsv" />
            <p class="text-xs text-dimmed">
              Live call — one cheap LLM request. The LLM maps arbitrary column names onto our lead fields.
            </p>
          </div>
        </UCard>

        <div class="flex flex-col gap-3">
          <UAlert v-if="csvError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="csvError.message" :description="csvError.info ?? undefined" />
          <template v-if="csvMapping">
            <div class="text-sm text-muted">
              {{ mappedEntries.length }} fields mapped · {{ unmappedFields.length }} without a match
            </div>
            <div class="rounded-xl bg-default shadow-sm divide-y divide-default">
              <div v-for="[field, column] in mappedEntries" :key="field" class="p-2.5 text-sm flex items-center gap-2">
                <UBadge color="neutral" variant="outline" size="sm" class="shrink-0 font-mono">
                  {{ field }}
                </UBadge>
                <UIcon name="i-lucide-arrow-left" class="size-3.5 text-dimmed shrink-0" />
                <span class="font-mono text-xs">{{ column }}</span>
              </div>
            </div>
            <p v-if="unmappedFields.length" class="text-xs text-muted">
              No match: {{ unmappedFields.join(', ') }}
            </p>
            <RawJson :data="csvMapping" />
          </template>
          <div v-else-if="!csvError" class="text-sm text-muted py-12 text-center rounded-xl bg-default shadow-sm">
            Paste a CSV with any column names — the mapping to our lead fields appears here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
