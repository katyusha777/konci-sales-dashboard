<script setup lang="ts">
import type { IGooglePlacesLiveResult } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const query = ref('')
const loading = ref(false)
const searched = ref(false)
const result = ref<IGooglePlacesLiveResult | null>(null)
const error = ref<ApiError | null>(null)

const samples = [
  { label: 'Franklin Barbecue', apply: () => query.value = 'Franklin Barbecue Austin TX' },
  { label: 'Katz\'s Delicatessen', apply: () => query.value = 'Katz\'s Delicatessen New York NY' },
  { label: 'Voodoo Doughnut', apply: () => query.value = 'Voodoo Doughnut Portland OR' },
]

async function lookup() {
  loading.value = true
  error.value = null
  try {
    result.value = await PlaygroundApi.googlePlacesLookup(query.value.trim())
    searched.value = true
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
  <UDashboardPanel id="playground-google-places">
    <template #header>
      <UDashboardNavbar title="Playground — Google Places">
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
          <UFormField label="Search query" help="Business name + city + state works best.">
            <UInput v-model="query" placeholder="Lonestar Dental Care Austin TX" class="w-full" @keydown.enter="query.trim() && lookup()" />
          </UFormField>
          <UButton icon="i-lucide-map" label="Look up live" block :loading="loading" :disabled="!query.trim()" @click="lookup" />
          <p class="text-xs text-dimmed">
            Live call — $0.017 per details request (find-place + details, two-step).
          </p>
          <p class="text-xs text-dimmed">
            Enrichment role: identity check + gap-fill — canonical website, structured
            hours, open/closed status. Scrap.io already covers rating/reviews at sourcing.
          </p>
        </div>

        <!-- Right: results -->
        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <UCard v-if="searched && !result && !error">
            <div class="text-sm text-muted flex items-center gap-2">
              <UIcon name="i-lucide-map-pin-off" class="size-5" />
              No place found for that query.
            </div>
          </UCard>

          <UCard v-if="result">
            <div class="flex flex-col gap-2 text-sm">
              <div class="flex items-center gap-2 flex-wrap">
                <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                <span class="font-medium">{{ result.name ?? '—' }}</span>
                <UBadge v-if="result.businessStatus && result.businessStatus !== 'OPERATIONAL'" color="error" variant="subtle" size="sm">
                  {{ result.businessStatus }}
                </UBadge>
                <UBadge v-if="result.openNow !== null" :color="result.openNow ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ result.openNow ? 'open now' : 'closed now' }}
                </UBadge>
                <span class="text-xs text-muted ms-auto">★ {{ result.rating ?? '—' }} ({{ result.reviewCount ?? 0 }})</span>
              </div>
              <div><span class="text-muted text-xs block">Address</span>{{ result.address ?? '—' }}</div>
              <div><span class="text-muted text-xs block">Phone / website</span>{{ result.phone ?? '—' }} · {{ result.website ?? '—' }}</div>
              <div v-if="result.types.length" class="flex items-center gap-1.5 flex-wrap">
                <span class="text-muted text-xs w-full">Categories</span>
                <UBadge v-for="t in result.types" :key="t" color="neutral" variant="outline" size="sm">
                  {{ t }}
                </UBadge>
              </div>
              <div v-if="result.businessHours.length">
                <span class="text-muted text-xs block">Hours</span>
                <div class="text-xs">
                  <div v-for="line in result.businessHours" :key="line">
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>
            <RawJson :data="result.raw" class="mt-3" />
          </UCard>

          <div v-if="!searched && !error" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
            Look up a business — verified Google data and raw JSON appear here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
