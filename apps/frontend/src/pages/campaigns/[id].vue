<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ICampaignLead, TCampaignStatus } from '~/app/types'
import { CampaignsApi } from '~/app/api/campaigns.api'
import { ApiError } from '~/app/api/client'
import { SchedulerApi } from '~/app/api/scheduler.api'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: campaign, status, refresh } = await useAsyncData(`campaigns.${id}`, () => CampaignsApi.get(id))

// Activate a DRAFT/PAUSED campaign, or pause an ACTIVE one.
const settingStatus = ref(false)
async function setStatus(next: TCampaignStatus) {
  settingStatus.value = true
  try {
    await CampaignsApi.setStatus(id, next)
    await refresh()
    const verb = next === 'ACTIVE' ? (campaign.value?.status === 'DRAFT' ? 'activated' : 'resumed') : 'paused'
    toast.add({ title: `Campaign ${verb}`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not update status', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    settingStatus.value = false
  }
}

// Manually run the scheduler now (same as the every-5-min cron) — sends the next due
// batch and polls videos. Rate limits still apply.
const running = ref(false)
async function runScheduler() {
  running.value = true
  try {
    const s = await SchedulerApi.run()
    await refresh()
    const parts = [
      `${s.emailsSent} email${s.emailsSent === 1 ? '' : 's'} sent`,
      s.videosCompleted ? `${s.videosCompleted} video(s) ready` : '',
    ].filter(Boolean)
    toast.add({ title: 'Scheduler ran', description: parts.join(' · '), color: s.emailsSent ? 'success' : 'info' })
  }
  catch (err) {
    toast.add({ title: 'Scheduler failed', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    running.value = false
  }
}

// Edit campaign settings (name, description, rate limits)
const editOpen = ref(false)
const editForm = reactive({ name: '', description: '', maxSendsPerHour: 20, maxSendsPerDay: 100 })
const savingEdit = ref(false)
function openEdit() {
  if (!campaign.value)
    return
  Object.assign(editForm, {
    name: campaign.value.name,
    description: campaign.value.description ?? '',
    maxSendsPerHour: campaign.value.maxSendsPerHour,
    maxSendsPerDay: campaign.value.maxSendsPerDay,
  })
  editOpen.value = true
}
async function saveEdit() {
  savingEdit.value = true
  try {
    await CampaignsApi.update(id, { ...editForm })
    await refresh()
    editOpen.value = false
    toast.add({ title: 'Campaign updated', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    savingEdit.value = false
  }
}

// Per-lead "Send now" — send this enrolled lead its current-step email immediately (testing)
const sendingLeadId = ref<string | null>(null)
async function sendLead(lead: ICampaignLead) {
  sendingLeadId.value = lead.id
  try {
    await CampaignsApi.sendLead(id, lead.id)
    await refresh()
    toast.add({ title: `Sent to ${lead.leadName}`, description: `Email to ${lead.contactEmail} (test mode redirects it).`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: `Could not send to ${lead.leadName}`, description: (err as ApiError).message, color: 'error' })
  }
  finally {
    sendingLeadId.value = null
  }
}

const leadColumns: Array<TableColumn<ICampaignLead>> = [
  { accessorKey: 'leadName', header: 'Lead' },
  { accessorKey: 'contactEmail', header: 'Contact' },
  { accessorKey: 'currentStep', header: 'Step' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'nextSendAt', header: 'Next send' },
  { accessorKey: 'withVideo', header: 'Video' },
  { id: 'actions', header: '' },
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
            v-if="campaign" icon="i-lucide-pencil" label="Edit" color="neutral" variant="ghost" @click="openEdit"
          />
          <!-- Run the scheduler now (send next due batch + poll videos) when active -->
          <UButton
            v-if="campaign && campaign.status === 'ACTIVE'"
            icon="i-lucide-zap" label="Run scheduler now" color="neutral" variant="outline"
            :loading="running" @click="runScheduler"
          />
          <!-- Status control: Activate a draft, Pause an active, Resume a paused campaign -->
          <UButton
            v-if="campaign && campaign.status === 'DRAFT'"
            icon="i-lucide-play" label="Activate" :loading="settingStatus" @click="setStatus('ACTIVE')"
          />
          <UButton
            v-else-if="campaign && campaign.status === 'ACTIVE'"
            icon="i-lucide-pause" label="Pause" color="neutral" variant="outline"
            :loading="settingStatus" @click="setStatus('PAUSED')"
          />
          <UButton
            v-else-if="campaign && campaign.status === 'PAUSED'"
            icon="i-lucide-play" label="Resume" :loading="settingStatus" @click="setStatus('ACTIVE')"
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
            <template #actions-cell="{ row }">
              <!-- Send now works on any lead for testing (completed leads re-send the last
                   step without changing state); only a suppressed contact is refused. -->
              <UButton
                size="xs" color="neutral" variant="ghost" icon="i-lucide-send"
                :label="['COMPLETED', 'REPLIED'].includes(row.original.status) ? 'Resend' : 'Send now'"
                :loading="sendingLeadId === row.original.id"
                :disabled="row.original.status === 'SUPPRESSED'"
                @click="sendLead(row.original)"
              />
            </template>
          </UTable>
        </UCard>
      </div>

      <!-- Edit campaign settings -->
      <UModal v-model:open="editOpen" title="Edit campaign">
        <template #body>
          <div class="flex flex-col gap-4">
            <UFormField label="Name" required>
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField label="Description">
              <UTextarea v-model="editForm.description" :rows="2" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Max sends / hour">
                <UInputNumber v-model="editForm.maxSendsPerHour" :min="1" />
              </UFormField>
              <UFormField label="Max sends / day">
                <UInputNumber v-model="editForm.maxSendsPerDay" :min="1" />
              </UFormField>
            </div>
          </div>
        </template>
        <template #footer>
          <UButton label="Save" :loading="savingEdit" :disabled="!editForm.name.trim()" @click="saveEdit" />
          <UButton label="Cancel" color="neutral" variant="ghost" @click="editOpen = false" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
