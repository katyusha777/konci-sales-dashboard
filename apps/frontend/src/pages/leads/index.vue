<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { IImportReport, ILead, ILeadCreate, IScrapioResult, IScrapioSearchParams, TEnrichmentStatus, TLeadStatus } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { LeadsApi } from '~/app/api/leads.api'

const toast = useToast()

const PER_PAGE_OPTIONS = [10, 25, 50, 100, 200]
const PER_PAGE_KEY = 'leads.perPage'

const filters = reactive({
  search: '',
  status: undefined as TLeadStatus | undefined,
  enrichmentStatus: undefined as TEnrichmentStatus | undefined,
  industry: undefined as string | undefined,
  minScore: undefined as number | undefined,
  page: 1,
  perPage: 10,
})

// Persist per-page choice (client-only)
onMounted(() => {
  const saved = Number(localStorage.getItem(PER_PAGE_KEY))
  if (PER_PAGE_OPTIONS.includes(saved))
    filters.perPage = saved
})
watch(() => filters.perPage, v => localStorage.setItem(PER_PAGE_KEY, String(v)))

const { data, status, refresh } = await useAsyncData(
  'leads.list',
  () => LeadsApi.list({ ...filters, search: filters.search || undefined }),
  { watch: [filters] },
)
const { data: industries } = await useAsyncData('leads.industries', () => LeadsApi.industries())

watch(() => [filters.search, filters.status, filters.enrichmentStatus, filters.industry, filters.minScore, filters.perPage], () => {
  filters.page = 1
})

const STATUS_OPTIONS: Array<TLeadStatus> = [
  'NEW',
  'ENRICHED',
  'IN_CAMPAIGN',
  'CONTACTED',
  'ENGAGED',
  'REPLIED',
  'CLOSED_WON',
  'CLOSED_LOST',
  'DO_NOT_CONTACT',
]
const ENRICHMENT_OPTIONS: Array<TEnrichmentStatus> = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED']

const UCheckbox = resolveComponent('UCheckbox')

const columns: Array<TableColumn<ILead>> = [
  {
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!v),
      'aria-label': 'Select all',
    }),
    cell: ({ row }) => h('div', { onClick: (e: Event) => e.stopPropagation() }, h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (v: boolean | 'indeterminate') => row.toggleSelected(!!v),
      'aria-label': 'Select row',
    })),
  },
  { accessorKey: 'name', header: 'Business' },
  { accessorKey: 'city', header: 'Location' },
  { accessorKey: 'industry', header: 'Industry' },
  { accessorKey: 'enrichmentScore', header: 'Score' },
  { accessorKey: 'enrichmentStatus', header: 'Enrichment' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'lastContactedAt', header: 'Last contact' },
  { accessorKey: 'totalCostUsd', header: 'Cost' },
]

// TanStack row-selection state: { [rowIndex]: true }
const rowSelection = ref<Record<string, boolean>>({})
const selectedLeads = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, on]) => on)
    .map(([index]) => data.value?.items[Number(index)])
    .filter((l): l is ILead => !!l),
)
watch(data, () => rowSelection.value = {})

function bulkAddToCampaign() {
  toast.add({ title: `${selectedLeads.value.length} leads would be added to a campaign`, description: 'Campaign picker comes with the campaign pages.', color: 'info' })
  rowSelection.value = {}
}

// Bulk enrich: 2 leads at a time (each request runs the full waterfall, 30s–3min)
const bulkEnriching = ref(false)
async function bulkEnrich() {
  const leads = [...selectedLeads.value]
  rowSelection.value = {}
  bulkEnriching.value = true
  let enriched = 0
  let skipped = 0
  let failed = 0
  const queue = [...leads]
  const worker = async () => {
    for (let lead = queue.shift(); lead; lead = queue.shift()) {
      try {
        await LeadsApi.enrich(lead.id)
        enriched++
      }
      catch (err) {
        if (err instanceof ApiError && err.status === 422)
          skipped++ // guard: fresh or out of attempts
        else
          failed++
      }
    }
  }
  try {
    await Promise.all([worker(), worker()])
  }
  finally {
    bulkEnriching.value = false
  }
  await refresh()
  toast.add({
    title: `Enrichment finished: ${enriched} enriched`,
    description: [skipped && `${skipped} skipped (fresh/attempt guard)`, failed && `${failed} failed`].filter(Boolean).join(' · ') || undefined,
    color: failed ? 'warning' : 'success',
  })
}

// --- Add lead (manual input) ---------------------------------------------------
const addModalOpen = ref(false)
const adding = ref(false)
const emptyLead = (): ILeadCreate => ({ name: '', website: '', email: '', phone: '', street: '', city: '', state: '', industry: '', notes: '' })
const newLead = reactive<ILeadCreate>(emptyLead())

async function addLead() {
  adding.value = true
  try {
    const created = await LeadsApi.create({ ...newLead })
    addModalOpen.value = false
    Object.assign(newLead, emptyLead())
    await refresh()
    toast.add({ title: `${created.name} added`, description: 'Starts as NEW / enrichment PENDING.', color: 'success' })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.status === 409 ? 'Duplicate lead' : 'Could not add lead', description: e.message, color: 'error' })
  }
  finally {
    adding.value = false
  }
}

// --- Import CSV (upload → map columns → report) ---------------------------------
type ImportStep = 'upload' | 'mapping' | 'report'
const importModalOpen = ref(false)
const importStep = ref<ImportStep>('upload')
const csvFile = ref<File | null>(null)
const csvHeaders = ref<Array<string>>([])
const csvRows = ref<Array<Record<string, string>>>([])
const csvMapping = reactive<Record<string, string | null>>({})
const mappingLoading = ref(false)
const importing = ref(false)
const importReport = ref<IImportReport | null>(null)

watch(importModalOpen, (open) => {
  if (open) {
    importStep.value = 'upload'
    csvFile.value = null
    csvHeaders.value = []
    csvRows.value = []
    importReport.value = null
  }
})

async function parseUpload() {
  if (!csvFile.value)
    return
  const { headers, rows } = parseCsv(await csvFile.value.text())
  if (!headers.length || !rows.length) {
    toast.add({ title: 'Empty CSV', description: 'No header row or data rows found.', color: 'error' })
    return
  }
  csvHeaders.value = headers
  csvRows.value = rows
  importStep.value = 'mapping'

  // LLM prefill — editable below, and optional: a failure just means manual mapping
  for (const f of CSV_IMPORT_FIELDS) csvMapping[f.key] = null
  mappingLoading.value = true
  try {
    const mapped = await LeadsApi.mapHeaders(headers, rows.slice(0, 3))
    for (const f of CSV_IMPORT_FIELDS) csvMapping[f.key] = mapped[f.key] ?? null
  }
  catch (err) {
    toast.add({ title: 'Automatic mapping unavailable', description: (err as ApiError).message, color: 'warning' })
  }
  finally {
    mappingLoading.value = false
  }
}

async function runImport() {
  importing.value = true
  try {
    importReport.value = await LeadsApi.importCsv(csvRows.value, { ...csvMapping })
    importStep.value = 'report'
    await refresh()
  }
  catch (err) {
    toast.add({ title: 'Import failed', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    importing.value = false
  }
}

// --- Find businesses (Scrap.io) ----------------------------------------------
const findModalOpen = ref(false)
const searchParams = reactive<IScrapioSearchParams>({
  keyword: '',
  location: '',
  category: '',
  excludeClosed: true,
  hasWebsite: false,
  hasPhone: false,
  minRating: null,
  minReviews: null,
})
const searchResults = ref<Array<IScrapioResult> | null>(null)
const searching = ref(false)
const importingPicked = ref(false)
const pickedIds = ref<Set<string>>(new Set())

async function runSearch() {
  searching.value = true
  try {
    const results = await LeadsApi.scrapioSearch(searchParams)
    // Defensive: only ever render a real array of results
    searchResults.value = Array.isArray(results) ? results : []
    pickedIds.value = new Set(searchResults.value.map(r => r.externalId))
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message, description: e.info ?? undefined, color: 'error' })
  }
  finally {
    searching.value = false
  }
}

function togglePicked(id: string) {
  if (pickedIds.value.has(id))
    pickedIds.value.delete(id)
  else
    pickedIds.value.add(id)
  pickedIds.value = new Set(pickedIds.value)
}

async function importPicked() {
  const picked = (searchResults.value ?? []).filter(r => pickedIds.value.has(r.externalId))
  importingPicked.value = true
  try {
    const count = await LeadsApi.scrapioImport(picked)
    findModalOpen.value = false
    searchResults.value = null
    await refresh()
    toast.add({ title: `${count} leads imported`, description: `${picked.length - count} were duplicates. They start as NEW / enrichment PENDING.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Import failed', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    importingPicked.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="leads">
    <template #header>
      <UDashboardNavbar title="Leads">
        <template #right>
          <UButton icon="i-lucide-search" color="neutral" variant="outline" label="Find businesses" @click="findModalOpen = true" />
          <UButton icon="i-lucide-upload" color="neutral" variant="outline" label="Import CSV" @click="importModalOpen = true" />
          <UButton icon="i-lucide-plus" label="Add lead" @click="addModalOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Filters -->
        <div class="flex flex-wrap gap-2 items-center">
          <UInput v-model="filters.search" icon="i-lucide-search" placeholder="Search name, domain, city…" class="w-64" />
          <USelectMenu v-model="filters.status" :items="STATUS_OPTIONS" placeholder="Status" class="w-40" />
          <USelectMenu v-model="filters.enrichmentStatus" :items="ENRICHMENT_OPTIONS" placeholder="Enrichment" class="w-40" />
          <USelectMenu v-model="filters.industry" :items="industries ?? []" placeholder="Industry" class="w-44" />
          <USelect
            v-model="filters.minScore"
            :items="[{ label: 'Any score', value: undefined as any }, { label: '60+', value: 60 }, { label: '80+', value: 80 }]"
            placeholder="Min score" class="w-32"
          />
          <UButton
            v-if="filters.status || filters.enrichmentStatus || filters.industry || filters.minScore || filters.search"
            color="neutral" variant="ghost" icon="i-lucide-x" label="Clear"
            @click="Object.assign(filters, { search: '', status: undefined, enrichmentStatus: undefined, industry: undefined, minScore: undefined })"
          />
          <span class="text-sm text-muted ms-auto">{{ data?.total ?? 0 }} leads</span>
        </div>

        <!-- Bulk action bar -->
        <UAlert v-if="selectedLeads.length || bulkEnriching" color="primary" variant="subtle" :title="bulkEnriching ? 'Enriching… each lead runs the full waterfall (30s–3min)' : `${selectedLeads.length} selected`">
          <template #actions>
            <UButton size="xs" icon="i-lucide-send" label="Add to campaign" :disabled="bulkEnriching" @click="bulkAddToCampaign" />
            <UButton size="xs" icon="i-lucide-sparkles" color="neutral" variant="outline" label="Enrich" :loading="bulkEnriching" @click="bulkEnrich" />
          </template>
        </UAlert>

        <UTable
          v-model:row-selection="rowSelection"
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          class="cursor-pointer"
          @select="(_e: Event, row: any) => navigateTo(`/leads/${row.original.id}`)"
        >
          <template #name-cell="{ row }">
            <div class="font-medium text-highlighted">
              {{ row.original.name }}
            </div>
            <div class="text-xs text-muted">
              {{ row.original.domain ?? '—' }}
            </div>
          </template>
          <template #city-cell="{ row }">
            {{ [row.original.city, row.original.state].filter(Boolean).join(', ') || '—' }}
          </template>
          <template #enrichmentScore-cell="{ row }">
            <div class="flex items-center gap-2">
              <UProgress :model-value="row.original.enrichmentScore" size="sm" class="w-14" />
              <span class="text-sm">{{ row.original.enrichmentScore }}</span>
            </div>
          </template>
          <template #enrichmentStatus-cell="{ row }">
            <StatusBadge :status="row.original.enrichmentStatus" />
          </template>
          <template #status-cell="{ row }">
            <StatusBadge :status="row.original.status" />
          </template>
          <template #lastContactedAt-cell="{ row }">
            {{ formatDate(row.original.lastContactedAt) }}
          </template>
          <template #totalCostUsd-cell="{ row }">
            {{ formatUsd(row.original.totalCostUsd) }}
          </template>
        </UTable>

        <div class="flex items-center justify-between">
          <USelect
            v-model="filters.perPage"
            :items="PER_PAGE_OPTIONS.map(n => ({ label: `${n} / page`, value: n }))"
            class="w-32"
          />
          <UPagination v-model:page="filters.page" :total="data?.total ?? 0" :items-per-page="filters.perPage" />
        </div>
      </div>

      <!-- Add lead (manual input) -->
      <UModal v-model:open="addModalOpen" title="Add lead" description="Enter the business — enrichment fills in the rest.">
        <template #body>
          <div class="flex flex-col gap-3">
            <UFormField label="Business name" required>
              <UInput v-model="newLead.name" placeholder="Joe's Barbershop" class="w-full" />
            </UFormField>
            <UFormField label="Website">
              <UInput v-model="newLead.website" placeholder="https://…" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="Email">
                <UInput v-model="newLead.email" placeholder="info@…" />
              </UFormField>
              <UFormField label="Phone">
                <UInput v-model="newLead.phone" placeholder="+1…" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="City">
                <UInput v-model="newLead.city" placeholder="Austin" />
              </UFormField>
              <UFormField label="State">
                <UInput v-model="newLead.state" placeholder="TX" />
              </UFormField>
            </div>
            <UFormField label="Industry">
              <UInput v-model="newLead.industry" placeholder="Barber shop" class="w-full" />
            </UFormField>
            <UFormField label="Note" hint="optional">
              <UTextarea v-model="newLead.notes" :rows="2" class="w-full" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <UButton label="Add lead" :loading="adding" :disabled="!newLead.name?.trim()" @click="addLead" />
        </template>
      </UModal>

      <!-- CSV import: upload → map columns → report -->
      <UModal v-model:open="importModalOpen" title="Import leads from CSV" :ui="{ content: 'max-w-2xl' }">
        <template #body>
          <!-- Step 1: upload -->
          <div v-if="importStep === 'upload'" class="flex flex-col gap-4">
            <UFileUpload v-model="csvFile" accept=".csv,text/csv" label="Drop your CSV export here" description="Column mapping happens after upload" />
          </div>

          <!-- Step 2: mapping -->
          <div v-else-if="importStep === 'mapping'" class="flex flex-col gap-3">
            <UAlert
              color="info" variant="subtle" icon="i-lucide-wand-sparkles"
              :title="mappingLoading ? 'Mapping columns with the LLM…' : `${csvRows.length} rows parsed`"
              :description="mappingLoading ? undefined : 'Check the automatic mapping — only Business name is required.'"
            />
            <div class="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-h-96 overflow-y-auto pr-1">
              <UFormField v-for="f in CSV_IMPORT_FIELDS" :key="f.key" :label="f.label" :required="f.required" size="sm">
                <USelectMenu
                  :model-value="csvMapping[f.key] ?? undefined"
                  :items="csvHeaders"
                  :disabled="mappingLoading"
                  placeholder="—"
                  class="w-full"
                  @update:model-value="csvMapping[f.key] = $event ?? null"
                />
              </UFormField>
            </div>
          </div>

          <!-- Step 3: report -->
          <div v-else class="flex flex-col gap-3">
            <UAlert
              :color="importReport?.errors.length ? 'warning' : 'success'" variant="subtle" icon="i-lucide-check-circle"
              :title="`${importReport?.created ?? 0} created · ${importReport?.duplicates ?? 0} duplicates skipped · ${importReport?.errors.length ?? 0} errors`"
            />
            <div v-if="importReport?.errors.length" class="border border-default rounded-lg divide-y divide-default max-h-64 overflow-y-auto text-sm">
              <div v-for="e in importReport.errors" :key="e.row" class="px-3 py-1.5">
                Row {{ e.row }}: <span class="text-muted">{{ e.error }}</span>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <template v-if="importStep === 'upload'">
            <UButton label="Continue" :disabled="!csvFile" @click="parseUpload" />
          </template>
          <template v-else-if="importStep === 'mapping'">
            <UButton color="neutral" variant="ghost" label="Back" @click="importStep = 'upload'" />
            <UButton :label="`Import ${csvRows.length} rows`" :loading="importing" :disabled="mappingLoading || !csvMapping.name" @click="runImport" />
          </template>
          <template v-else>
            <UButton label="Done" @click="importModalOpen = false" />
          </template>
        </template>
      </UModal>

      <!-- Find businesses via Scrap.io -->
      <UModal v-model:open="findModalOpen" title="Find businesses" description="Search Google Maps data via Scrap.io and import the results as leads." :ui="{ content: 'max-w-4xl' }">
        <template #body>
          <div class="grid md:grid-cols-[16rem_1fr] gap-6">
            <!-- Search form -->
            <div class="flex flex-col gap-3">
              <UFormField label="Keyword">
                <UInput v-model="searchParams.keyword" placeholder="barbershop, gym…" class="w-full" />
              </UFormField>
              <UFormField label="Location" hint="State or City, State">
                <UInput v-model="searchParams.location" placeholder="TX or Austin, TX" class="w-full" />
              </UFormField>
              <UFormField label="Category" hint="Google Maps category">
                <UInput v-model="searchParams.category" placeholder="restaurant, gym…" class="w-full" />
              </UFormField>
              <UCheckbox v-model="searchParams.excludeClosed" label="Exclude permanently closed" />
              <UCheckbox v-model="searchParams.hasWebsite" label="Has website" />
              <UCheckbox v-model="searchParams.hasPhone" label="Has phone" />
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Min rating">
                  <UInputNumber :model-value="searchParams.minRating ?? undefined" :min="0" :max="5" :step="0.5" placeholder="4.0" @update:model-value="searchParams.minRating = $event ?? null" />
                </UFormField>
                <UFormField label="Min reviews">
                  <UInputNumber :model-value="searchParams.minReviews ?? undefined" :min="0" placeholder="10" @update:model-value="searchParams.minReviews = $event ?? null" />
                </UFormField>
              </div>
              <UButton
                block icon="i-lucide-search" label="Search" :loading="searching"
                :disabled="!searchParams.keyword && !searchParams.category"
                @click="runSearch"
              />
            </div>

            <!-- Results -->
            <div class="flex flex-col gap-2 min-h-64">
              <div v-if="!searchResults" class="flex-1 flex flex-col items-center justify-center text-muted gap-2">
                <UIcon name="i-lucide-search" class="size-8" />
                <span class="text-sm">Set filters and click Search</span>
              </div>
              <template v-else>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">{{ searchResults.length }} results · {{ pickedIds.size }} selected</span>
                  <UButton size="xs" :disabled="!pickedIds.size" :loading="importingPicked" :label="`Import ${pickedIds.size} selected`" @click="importPicked" />
                </div>
                <div class="divide-y divide-default border border-default rounded-lg max-h-96 overflow-y-auto">
                  <label v-for="r in searchResults" :key="r.externalId" class="flex items-center gap-3 p-2.5 hover:bg-elevated cursor-pointer">
                    <UCheckbox :model-value="pickedIds.has(r.externalId)" @update:model-value="togglePicked(r.externalId)" />
                    <div class="flex-1">
                      <div class="text-sm font-medium">{{ r.name }}</div>
                      <div class="text-xs text-muted">{{ [r.city, r.state].filter(Boolean).join(', ') }} · ★ {{ r.rating ?? '—' }} ({{ r.reviewCount ?? 0 }}) · {{ r.website ?? 'no website' }} · {{ r.phone ?? 'no phone' }}</div>
                    </div>
                  </label>
                </div>
              </template>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
