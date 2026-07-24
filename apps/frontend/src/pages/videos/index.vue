<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { IVideoListItem } from '~/app/types'
import type { ApiError } from '~/app/api/client'
import { VideosApi } from '~/app/api/video.api'

const toast = useToast()

const page = ref(1)
const perPage = ref(25)

const { data, status, refresh } = await useAsyncData(
  'videos.list',
  () => VideosApi.list(page.value, perPage.value),
  { watch: [page, perPage] },
)

const processingCount = computed(() => (data.value?.items ?? []).filter(v => v.status === 'PROCESSING' || v.status === 'PENDING').length)

// Manual recheck: the prod cron polls HeyGen every 5 min, but local dev never does —
// this button is how a "stuck on Processing" render gets resolved.
const polling = ref(false)
async function pollNow() {
  polling.value = true
  try {
    const s = await VideosApi.poll()
    await refresh()
    toast.add({
      title: `${s.completed} completed · ${s.failed} failed · ${s.processing} still rendering`,
      description: s.processing ? 'Still-rendering videos usually finish within a few minutes — check again shortly.' : undefined,
      color: s.failed ? 'warning' : 'success',
    })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Poll failed', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    polling.value = false
  }
}

function copyLink(token: string) {
  navigator.clipboard.writeText(`${location.origin}/v/${token}`)
  toast.add({ title: 'Public video link copied', color: 'success' })
}

const columns: Array<TableColumn<IVideoListItem>> = [
  { accessorKey: 'video', header: 'Video' },
  { accessorKey: 'lead', header: 'Lead' },
  { accessorKey: 'templateName', header: 'Template' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'durationSeconds', header: 'Length' },
  { accessorKey: 'costUsd', header: 'Cost' },
  { accessorKey: 'createdAt', header: 'Created' },
  { id: 'actions' },
]
</script>

<template>
  <UDashboardPanel id="videos">
    <template #header>
      <UDashboardNavbar title="Videos">
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw" color="neutral" variant="outline"
            :label="processingCount ? `Check ${processingCount} processing` : 'Check processing'"
            :loading="polling" @click="pollNow"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          Every HeyGen render, newest first. Renders complete in the background — in production
          the scheduler checks every 5 minutes; locally use “Check processing”.
        </p>

        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
        >
          <template #video-cell="{ row }">
            <a v-if="row.original.status === 'COMPLETED'" :href="`/v/${row.original.token}`" target="_blank" class="block relative group w-28">
              <div class="aspect-video w-28 rounded-md bg-elevated flex items-center justify-center overflow-hidden">
                <UIcon name="i-lucide-video" class="size-5 text-muted" />
                <!-- Hide on load error (legacy renders whose thumb never reached the real bucket) -->
                <img
                  v-if="row.original.hasThumbnail" :src="VideosApi.thumbUrl(row.original.token)" alt=""
                  class="absolute inset-0 aspect-video object-cover w-28"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
              </div>
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <UIcon name="i-lucide-circle-play" class="size-6 text-white drop-shadow" />
              </div>
            </a>
            <div v-else class="aspect-video w-28 rounded-md bg-elevated flex items-center justify-center">
              <UIcon
                :name="row.original.status === 'FAILED' ? 'i-lucide-circle-x' : 'i-lucide-loader-circle'"
                :class="row.original.status === 'FAILED' ? 'text-error' : 'animate-spin text-muted'"
                class="size-5"
              />
            </div>
          </template>
          <template #lead-cell="{ row }">
            <NuxtLink :to="`/leads/${row.original.lead.id}`" class="font-medium text-highlighted hover:underline">
              {{ row.original.lead.name }}
            </NuxtLink>
          </template>
          <template #templateName-cell="{ row }">
            {{ row.original.templateName ?? '—' }}
          </template>
          <template #status-cell="{ row }">
            <div class="flex items-center gap-1.5 flex-wrap">
              <StatusBadge :status="row.original.status" />
              <UBadge v-if="row.original.isTest" color="warning" variant="outline" size="sm">
                test
              </UBadge>
              <UBadge v-if="row.original.isOutreach" color="success" variant="subtle" size="sm">
                outreach video
              </UBadge>
              <UTooltip v-if="row.original.error" :text="row.original.error">
                <UIcon name="i-lucide-triangle-alert" class="size-4 text-error" />
              </UTooltip>
            </div>
          </template>
          <template #durationSeconds-cell="{ row }">
            {{ row.original.durationSeconds ? `${row.original.durationSeconds}s` : '—' }}
          </template>
          <template #costUsd-cell="{ row }">
            {{ row.original.costUsd ? formatUsd(row.original.costUsd) : 'free' }}
          </template>
          <template #createdAt-cell="{ row }">
            {{ formatDateTime(row.original.createdAt) }}
          </template>
          <template #actions-cell="{ row }">
            <div v-if="row.original.status === 'COMPLETED'" class="flex gap-1">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-external-link" label="Watch" :to="`/v/${row.original.token}`" target="_blank" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" aria-label="Copy public link" @click="copyLink(row.original.token)" />
            </div>
          </template>
          <template #empty>
            <div class="p-8 flex flex-col items-center gap-2 text-muted">
              <UIcon name="i-lucide-clapperboard" class="size-8" />
              <span class="text-sm">No videos yet — generate one from a lead page or the Templates editor.</span>
            </div>
          </template>
        </UTable>

        <div v-if="(data?.total ?? 0) > perPage" class="flex justify-end">
          <UPagination v-model:page="page" :total="data?.total ?? 0" :items-per-page="perPage" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
