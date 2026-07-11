<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ICampaign } from '~/app/types'
import { CampaignsApi } from '~/app/api/campaigns.api'

const { data: campaigns, status } = await useAsyncData('campaigns.list', () => CampaignsApi.list())

const columns: Array<TableColumn<ICampaign>> = [
  { accessorKey: 'name', header: 'Campaign' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'stats', header: 'Progress' },
  { accessorKey: 'rates', header: 'Engagement' },
  { accessorKey: 'createdAt', header: 'Created' },
]
</script>

<template>
  <UDashboardPanel id="campaigns">
    <template #header>
      <UDashboardNavbar title="Campaigns">
        <template #right>
          <UButton icon="i-lucide-plus" label="New campaign" to="/campaigns/new" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable
        :data="campaigns ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        @select="(_e: Event, row: any) => navigateTo(`/campaigns/${row.original.id}`)"
      >
        <template #name-cell="{ row }">
          <div class="font-medium text-highlighted">
            {{ row.original.name }}
          </div>
          <div class="text-xs text-muted">
            {{ row.original.description }}
          </div>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :status="row.original.status" />
        </template>
        <template #stats-cell="{ row }">
          <div class="flex items-center gap-2">
            <UProgress :model-value="row.original.stats.sent" :max="row.original.stats.leads || 1" size="sm" class="w-20" />
            <span class="text-sm text-muted">{{ row.original.stats.sent }}/{{ row.original.stats.leads }}</span>
          </div>
        </template>
        <template #rates-cell="{ row }">
          <span class="text-sm">
            {{ row.original.stats.sent ? formatPercent(row.original.stats.opened / row.original.stats.sent) : '—' }} open ·
            {{ row.original.stats.sent ? formatPercent(row.original.stats.clicked / row.original.stats.sent) : '—' }} click
          </span>
        </template>
        <template #createdAt-cell="{ row }">
          {{ formatDate(row.original.createdAt) }}
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
