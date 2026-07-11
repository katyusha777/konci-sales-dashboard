<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ICampaignLead } from '~/app/types'
import { CampaignsApi } from '~/app/api/campaigns.api'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: campaign, status, refresh } = await useAsyncData(`campaigns.${id}`, () => CampaignsApi.get(id))

async function toggle() {
  if (!campaign.value)
    return
  const next = campaign.value.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
  await CampaignsApi.setStatus(id, next)
  await refresh()
  toast.add({ title: next === 'ACTIVE' ? 'Campaign resumed' : 'Campaign paused', color: 'success' })
}

const leadColumns: Array<TableColumn<ICampaignLead>> = [
  { accessorKey: 'leadName', header: 'Lead' },
  { accessorKey: 'contactEmail', header: 'Contact' },
  { accessorKey: 'currentStep', header: 'Step' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'nextSendAt', header: 'Next send' },
  { accessorKey: 'withVideo', header: 'Video' },
]
</script>

<template>
  <UDashboardPanel id="campaign-detail">
    <template #header>
      <UDashboardNavbar :title="campaign?.name ?? 'Campaign'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/campaigns" aria-label="Back" />
        </template>
        <template #right>
          <StatusBadge v-if="campaign" :status="campaign.status" />
          <UButton
            v-if="campaign && ['ACTIVE', 'PAUSED'].includes(campaign.status)"
            :icon="campaign.status === 'ACTIVE' ? 'i-lucide-pause' : 'i-lucide-play'"
            :label="campaign.status === 'ACTIVE' ? 'Pause' : 'Resume'"
            color="neutral" variant="outline" @click="toggle"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending' && !campaign" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="animate-spin size-6 text-muted" />
      </div>

      <div v-else-if="campaign" class="flex flex-col gap-6">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Leads" :value="campaign.stats.leads" icon="i-lucide-users" />
          <StatCard label="Sent" :value="campaign.stats.sent" icon="i-lucide-send" />
          <StatCard label="Opened" :value="campaign.stats.opened" :sub="campaign.stats.sent ? formatPercent(campaign.stats.opened / campaign.stats.sent) : undefined" icon="i-lucide-mail-open" />
          <StatCard label="Clicked" :value="campaign.stats.clicked" :sub="campaign.stats.sent ? formatPercent(campaign.stats.clicked / campaign.stats.sent) : undefined" icon="i-lucide-mouse-pointer-click" />
          <StatCard label="Replied" :value="campaign.stats.replied" icon="i-lucide-reply" />
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Sequence</span>
              <span class="text-xs text-muted">{{ campaign.maxSendsPerHour }}/hr · {{ campaign.maxSendsPerDay }}/day</span>
            </div>
          </template>
          <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
            <template v-for="(s, i) in campaign.steps" :key="s.id">
              <UIcon v-if="i > 0" name="i-lucide-arrow-right" class="size-4 text-dimmed hidden sm:block" />
              <div class="border border-default rounded-lg px-3 py-2 text-sm flex-1">
                <div class="text-xs text-muted">
                  {{ i === 0 ? 'Initial send' : `+${s.delayDays} days` }}
                </div>
                <div class="font-medium">
                  {{ s.templateName }}
                </div>
              </div>
            </template>
            <p v-if="!campaign.steps.length" class="text-sm text-muted">
              No steps defined.
            </p>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <span class="font-medium">Leads in campaign</span>
          </template>
          <UTable :data="campaign.leads" :columns="leadColumns">
            <template #leadName-cell="{ row }">
              <NuxtLink :to="`/leads/${row.original.leadId}`" class="font-medium text-primary">
                {{ row.original.leadName }}
              </NuxtLink>
            </template>
            <template #currentStep-cell="{ row }">
              {{ row.original.currentStep + 1 }}/{{ campaign.steps.length || 1 }}
            </template>
            <template #status-cell="{ row }">
              <StatusBadge :status="row.original.status" />
            </template>
            <template #nextSendAt-cell="{ row }">
              {{ formatDateTime(row.original.nextSendAt) }}
            </template>
            <template #withVideo-cell="{ row }">
              <UIcon v-if="row.original.withVideo" name="i-lucide-video" class="size-4 text-primary" />
              <span v-else class="text-dimmed">—</span>
            </template>
          </UTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
