<script setup lang="ts">
import { ApiError } from '~/app/api/client'
import { CampaignsApi } from '~/app/api/campaigns.api'
import { LeadsApi } from '~/app/api/leads.api'
import { TemplatesApi } from '~/app/api/templates.api'

const toast = useToast()

const stepper = ref(0)
const steps = [
  { title: 'Details', description: 'Name & limits', icon: 'i-lucide-pencil' },
  { title: 'Sequence', description: 'Emails & delays', icon: 'i-lucide-list-ordered' },
  { title: 'Leads', description: 'Who gets it', icon: 'i-lucide-users' },
  { title: 'Review', description: 'Launch', icon: 'i-lucide-rocket' },
]

const form = reactive({
  name: '',
  description: '',
  maxSendsPerHour: 20,
  maxSendsPerDay: 100,
  sequence: [{ templateId: undefined as string | undefined, delayDays: 0 }],
  leadIds: [] as Array<string>,
  videoTopN: 2,
})

const { data: templates } = await useAsyncData('templates.list', () => TemplatesApi.list())
const { data: leadPool } = await useAsyncData('campaigns.leadpool', () => LeadsApi.list({ perPage: 100 }))

const templateOptions = computed(() => (templates.value ?? []).map(t => ({ label: t.name, value: t.id })))
const eligibleLeads = computed(() => (leadPool.value?.items ?? []).filter(l => !['DO_NOT_CONTACT', 'CLOSED_WON', 'CLOSED_LOST'].includes(l.status)))

const creating = ref(false)
async function launch() {
  const steps = form.sequence.filter(s => s.templateId).map(s => ({ templateId: s.templateId!, delayDays: s.delayDays }))
  if (!steps.length) {
    toast.add({ title: 'Add at least one email', description: 'Pick a template for the initial send.', color: 'warning' })
    return
  }
  if (!form.leadIds.length) {
    toast.add({ title: 'Select at least one lead', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const campaign = await CampaignsApi.create({
      name: form.name,
      description: form.description,
      maxSendsPerHour: form.maxSendsPerHour,
      maxSendsPerDay: form.maxSendsPerDay,
      steps,
      leadIds: form.leadIds,
      videoTopN: form.videoTopN,
    })
    toast.add({ title: `Campaign "${campaign.name}" created as draft`, description: `${campaign.stats.leads} leads enrolled, ${steps.length} steps. Activate it from the campaign page.`, color: 'success' })
    await navigateTo(`/campaigns/${campaign.id}`)
  }
  catch (err) {
    toast.add({ title: 'Could not create campaign', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="campaign-new">
    <template #header>
      <UDashboardNavbar title="New campaign">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/campaigns" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-3xl mx-auto w-full flex flex-col gap-6">
        <UStepper v-model="stepper" :items="steps" />

        <!-- Step 1: details -->
        <UCard v-if="stepper === 0">
          <div class="flex flex-col gap-4">
            <UFormField label="Name" required>
              <UInput v-model="form.name" placeholder="Dental — Austin" class="w-full" />
            </UFormField>
            <UFormField label="Description">
              <UTextarea v-model="form.description" :rows="2" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Max sends / hour">
                <UInputNumber v-model="form.maxSendsPerHour" :min="1" />
              </UFormField>
              <UFormField label="Max sends / day">
                <UInputNumber v-model="form.maxSendsPerDay" :min="1" />
              </UFormField>
            </div>
          </div>
        </UCard>

        <!-- Step 2: sequence -->
        <UCard v-if="stepper === 1">
          <div class="flex flex-col gap-3">
            <div v-for="(s, i) in form.sequence" :key="i" class="flex items-end gap-3">
              <UBadge color="neutral" variant="outline" class="mb-1.5">
                {{ i === 0 ? 'Initial' : `Step ${i + 1}` }}
              </UBadge>
              <UFormField label="Template" class="flex-1">
                <USelectMenu v-model="s.templateId" value-key="value" :items="templateOptions" placeholder="Pick a template" class="w-full" />
              </UFormField>
              <UFormField v-if="i > 0" label="Wait (days)">
                <UInputNumber v-model="s.delayDays" :min="1" class="w-24" />
              </UFormField>
              <UButton v-if="i > 0" icon="i-lucide-trash-2" color="error" variant="ghost" class="mb-1" @click="form.sequence.splice(i, 1)" />
            </div>
            <UButton
              icon="i-lucide-plus" variant="outline" color="neutral" label="Add follow-up" class="self-start"
              @click="form.sequence.push({ templateId: undefined, delayDays: 3 })"
            />
          </div>
        </UCard>

        <!-- Step 3: leads -->
        <UCard v-if="stepper === 2">
          <div class="flex flex-col gap-4">
            <p class="text-sm text-muted">
              Select leads manually — filter-based selection arrives with the backend. Top
              <UInputNumber v-model="form.videoTopN" :min="0" :max="form.leadIds.length" class="w-20 inline-flex mx-1" />
              leads by score get a personalized video.
            </p>
            <div class="max-h-96 overflow-y-auto divide-y divide-default border border-default rounded-lg">
              <label v-for="l in eligibleLeads" :key="l.id" class="flex items-center gap-3 p-2.5 hover:bg-elevated cursor-pointer">
                <UCheckbox
                  :model-value="form.leadIds.includes(l.id)"
                  @update:model-value="(v: any) => v ? form.leadIds.push(l.id) : form.leadIds.splice(form.leadIds.indexOf(l.id), 1)"
                />
                <span class="flex-1 text-sm font-medium">{{ l.name }}</span>
                <span class="text-xs text-muted">{{ l.city }}, {{ l.state }}</span>
                <span class="text-xs">score {{ l.enrichmentScore }}</span>
                <StatusBadge :status="l.status" />
              </label>
            </div>
            <span class="text-sm text-muted">{{ form.leadIds.length }} selected</span>
          </div>
        </UCard>

        <!-- Step 4: review -->
        <UCard v-if="stepper === 3">
          <div class="flex flex-col gap-3 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Name</span><span class="font-medium">{{ form.name || '—' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Sequence</span><span>{{ form.sequence.length }} email(s)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Leads</span><span>{{ form.leadIds.length }} ({{ Math.min(form.videoTopN, form.leadIds.length) }} with video)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Rate limits</span><span>{{ form.maxSendsPerHour }}/hr · {{ form.maxSendsPerDay }}/day</span>
            </div>
            <UAlert color="warning" variant="subtle" icon="i-lucide-flask-conical" title="Test mode is ON" description="All emails go to the test recipient until EMAIL_TEST_MODE is turned off." />
          </div>
        </UCard>

        <div class="flex justify-between">
          <UButton v-if="stepper > 0" color="neutral" variant="outline" label="Back" @click="stepper--" />
          <span v-else />
          <UButton v-if="stepper < 3" label="Continue" :disabled="stepper === 0 && !form.name" @click="stepper++" />
          <UButton v-else icon="i-lucide-rocket" label="Create campaign" :loading="creating" @click="launch" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
