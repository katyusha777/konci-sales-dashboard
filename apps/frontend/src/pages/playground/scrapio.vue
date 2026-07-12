<script setup lang="ts">
import type { IScrapioLiveParams, IScrapioLiveSearch } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const params = reactive<IScrapioLiveParams>({
  type: '',
  location: '',
  minRating: undefined,
  minReviews: undefined,
  requireWebsite: false,
  requirePhone: false,
  excludeClosed: true,
  perPage: 10,
})

const result = ref<IScrapioLiveSearch | null>(null)
const loading = ref(false)
const error = ref<ApiError | null>(null)

async function search(cursor?: string) {
  loading.value = true
  error.value = null
  try {
    const res = await PlaygroundApi.scrapioSearch({ ...toRaw(params), cursor })
    if (cursor && result.value)
      result.value = { ...res, results: [...result.value.results, ...res.results] }
    else
      result.value = res
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
  <UDashboardPanel id="playground-scrapio">
    <template #header>
      <UDashboardNavbar title="Playground — Scrap.io">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid lg:grid-cols-[18rem_1fr] gap-6">
        <!-- Form -->
        <div class="flex flex-col gap-3">
          <UFormField label="Business type" hint="Google Maps category">
            <UInput v-model="params.type" placeholder="dentist, restaurant…" class="w-full" />
          </UFormField>
          <UFormField label="Location" hint="TX or Austin, TX">
            <UInput v-model="params.location" placeholder="Austin, TX" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Min rating">
              <UInputNumber :model-value="params.minRating" :min="0" :max="5" :step="0.5" @update:model-value="params.minRating = $event ?? undefined" />
            </UFormField>
            <UFormField label="Min reviews">
              <UInputNumber :model-value="params.minReviews" :min="0" @update:model-value="params.minReviews = $event ?? undefined" />
            </UFormField>
          </div>
          <UCheckbox v-model="params.requireWebsite" label="Has website" />
          <UCheckbox v-model="params.requirePhone" label="Has phone" />
          <UCheckbox v-model="params.excludeClosed" label="Exclude permanently closed" />
          <UFormField label="Results per page">
            <USelect v-model="params.perPage" :items="[1, 10, 25, 50]" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-search" label="Search live" :loading="loading" :disabled="!params.type" @click="search()" />
          <p class="text-xs text-dimmed">
            Live call — consumes Scrap.io credits.
          </p>
        </div>

        <!-- Results -->
        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <template v-if="result">
            <div class="text-sm text-muted">
              {{ result.results.length }} loaded{{ result.total !== null ? ` of ~${result.total}` : '' }}
            </div>
            <div class="border border-default rounded-lg divide-y divide-default">
              <div v-for="r in result.results" :key="r.externalId" class="p-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-sm">{{ r.name }}</span>
                  <UBadge v-if="r.industry" color="neutral" variant="outline" size="sm">
                    {{ r.industry }}
                  </UBadge>
                  <UBadge v-if="r.isPermanentlyClosed" color="error" variant="subtle" size="sm">
                    closed
                  </UBadge>
                  <span class="text-xs text-muted ms-auto">★ {{ r.rating ?? '—' }} ({{ r.reviewCount ?? 0 }})</span>
                </div>
                <div class="text-xs text-muted mt-1">
                  {{ [r.street, r.city, r.state].filter(Boolean).join(', ') || 'no address' }}
                  · {{ r.website ?? 'no website' }} · {{ r.phone ?? 'no phone' }} · {{ r.email ?? 'no email' }}
                </div>
              </div>
            </div>
            <UButton
              v-if="result.nextCursor"
              variant="outline" color="neutral" label="Load more (next cursor)" :loading="loading" class="self-start"
              @click="search(result.nextCursor!)"
            />
            <RawJson :data="result" />
          </template>

          <div v-else-if="!error" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
            Set a business type and search — results and raw JSON appear here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
