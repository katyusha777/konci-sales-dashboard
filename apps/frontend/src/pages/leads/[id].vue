<script setup lang="ts">
import type { IEnrichmentResponse } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { LeadsApi } from '~/app/api/leads.api'
import { TemplatesApi } from '~/app/api/templates.api'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: lead, status, refresh } = await useAsyncData(`leads.${id}`, () => LeadsApi.get(id))
const { data: templates } = await useAsyncData('templates.list', () => TemplatesApi.list())

// Test video (per-lead, like the old pipeline had)
const videoTemplateOptions = computed(() => (templates.value ?? [])
  .filter(t => t.videoScript !== null || t.heygenTemplateId)
  .map(t => ({ label: t.name, value: t.id })))
const testVideoTemplateId = ref<string | undefined>()

function generateTestVideo() {
  const name = videoTemplateOptions.value.find(o => o.value === testVideoTemplateId.value)?.label
  toast.add({ title: `Test video queued (simulated)`, description: `Template: ${name} — real HeyGen rendering arrives with the avatars backend.`, color: 'info' })
}

async function suppress() {
  await LeadsApi.update(id, { status: 'DO_NOT_CONTACT' })
  await refresh()
  toast.add({ title: 'Lead suppressed', description: 'Status set to Do not contact — campaigns will skip it.', color: 'warning' })
}

// Re-enrich forces past the 30-day/3-attempt guard and re-attempts charged contacts.
// The request holds while the full waterfall runs (30s–3min).
const enriching = ref(false)
async function enrich() {
  enriching.value = true
  try {
    await LeadsApi.enrich(id, true)
    toast.add({ title: 'Lead enriched', color: 'success' })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Enrichment failed', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    enriching.value = false
    // Partial results (and the FAILED status/error) are worth showing either way
    await refresh()
    if (responses.value !== null)
      await loadResponses()
  }
}

// Activity tab: the per-provider-call audit ledger, loaded on first open
const responses = ref<Array<IEnrichmentResponse> | null>(null)
const responsesLoading = ref(false)
async function loadResponses() {
  responsesLoading.value = true
  try {
    responses.value = await LeadsApi.enrichmentResponses(id)
  }
  finally {
    responsesLoading.value = false
  }
}
const activeTab = ref('0')
watch(activeTab, (v) => {
  if (tabs[Number(v)]?.slot === 'activity' && responses.value === null && !responsesLoading.value)
    loadResponses()
})

const konci = reactive({ konciCustomerId: '', demoPhone: '', demoPin: '' })
watch(lead, (l) => {
  if (l)
    Object.assign(konci, { konciCustomerId: l.konciCustomerId ?? '', demoPhone: l.demoPhone ?? '', demoPin: l.demoPin ?? '' })
}, { immediate: true })

async function saveKonci() {
  await LeadsApi.update(id, {
    konciCustomerId: konci.konciCustomerId || null,
    demoPhone: konci.demoPhone || null,
    demoPin: konci.demoPin || null,
  })
  await refresh()
  toast.add({ title: 'Konci details saved', color: 'success' })
}

const newNote = ref('')
async function addNote() {
  if (!newNote.value.trim())
    return
  await LeadsApi.addNote(id, newNote.value.trim())
  newNote.value = ''
  await refresh()
}

const tabs = [
  { label: 'Contacts', slot: 'contacts', icon: 'i-lucide-users' },
  { label: 'Emails', slot: 'emails', icon: 'i-lucide-mail' },
  { label: 'Notes', slot: 'notes', icon: 'i-lucide-sticky-note' },
  { label: 'Costs', slot: 'costs', icon: 'i-lucide-circle-dollar-sign' },
  { label: 'Activity', slot: 'activity', icon: 'i-lucide-activity' },
]
</script>

<template>
  <UDashboardPanel id="lead-detail">
    <template #header>
      <UDashboardNavbar :title="lead?.name ?? 'Lead'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/leads" aria-label="Back" />
        </template>
        <template #right>
          <StatusBadge v-if="lead" :status="lead.status" />
          <UButton
            v-if="lead && lead.status !== 'DO_NOT_CONTACT'"
            icon="i-lucide-bell-off" color="error" variant="ghost" label="Suppress" @click="suppress"
          />
          <UButton icon="i-lucide-sparkles" :loading="enriching" color="neutral" variant="outline" label="Re-enrich" @click="enrich" />
          <UButton
            icon="i-lucide-send" label="Add to campaign"
            @click="toast.add({ title: 'Campaign picker comes with the campaign pages', color: 'info' })"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending' && !lead" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="animate-spin size-6 text-muted" />
      </div>

      <div v-else-if="lead" class="flex flex-col gap-4">
        <div class="grid lg:grid-cols-3 gap-4">
          <!-- Business info -->
          <UCard class="lg:col-span-2">
            <template #header>
              <span class="font-medium">Business</span>
            </template>
            <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><span class="text-muted block text-xs">Website</span><a v-if="lead.website" :href="lead.website" target="_blank" class="text-primary">{{ lead.domain }}</a><span v-else>—</span></div>
              <div><span class="text-muted block text-xs">Email</span>{{ lead.email ?? '—' }}</div>
              <div><span class="text-muted block text-xs">Phone</span>{{ lead.phone ?? '—' }}</div>
              <div><span class="text-muted block text-xs">Industry</span>{{ lead.industry ?? '—' }}</div>
              <div><span class="text-muted block text-xs">Address</span>{{ lead.street }}, {{ lead.city }}, {{ lead.state }} {{ lead.postalCode }}</div>
              <div><span class="text-muted block text-xs">Google</span>★ {{ lead.googleRating ?? '—' }} ({{ lead.googleReviewCount ?? 0 }} reviews)</div>
              <div><span class="text-muted block text-xs">Source</span>{{ lead.source }}</div>
              <div><span class="text-muted block text-xs">Assigned to</span>{{ lead.assignedTo ?? 'Unassigned' }}</div>
              <div v-if="lead.ownerName">
                <span class="text-muted block text-xs">Owner</span>{{ lead.ownerName }}
              </div>
            </div>
            <p v-if="lead.description" class="text-sm text-muted mt-4 border-t border-default pt-3">
              {{ lead.description }}
            </p>
            <div v-if="lead.services.length" class="flex flex-wrap gap-1.5 mt-3">
              <UBadge v-for="s in lead.services" :key="s" color="neutral" variant="outline" size="sm">
                {{ s }}
              </UBadge>
            </div>
          </UCard>

          <!-- Enrichment + Konci -->
          <div class="flex flex-col gap-4">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-medium">Enrichment</span>
                  <StatusBadge :status="lead.enrichmentStatus" />
                </div>
              </template>
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-3">
                  <UProgress :model-value="lead.enrichmentScore" class="flex-1" />
                  <span class="font-semibold">{{ lead.enrichmentScore }}/100</span>
                </div>
                <div class="text-xs text-muted">
                  {{ lead.enrichmentAttempts }} attempt(s) · last {{ formatDate(lead.lastEnrichedAt) }} · cost {{ formatUsd(lead.totalCostUsd) }}
                </div>
                <UAlert v-if="lead.enrichmentError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="lead.enrichmentError" />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <span class="font-medium">Konci platform</span>
              </template>
              <div class="flex flex-col gap-3">
                <UFormField label="Customer ID" size="sm">
                  <UInput v-model="konci.konciCustomerId" placeholder="kc_…" class="w-full" />
                </UFormField>
                <div class="grid grid-cols-2 gap-2">
                  <UFormField label="Demo phone" size="sm">
                    <UInput v-model="konci.demoPhone" placeholder="+1…" />
                  </UFormField>
                  <UFormField label="PIN" size="sm">
                    <UInput v-model="konci.demoPin" placeholder="0000" />
                  </UFormField>
                </div>
                <UButton size="sm" label="Save" @click="saveKonci" />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <span class="font-medium">Test video</span>
              </template>
              <div class="flex flex-col gap-3">
                <UFormField label="Template" size="sm">
                  <USelectMenu v-model="testVideoTemplateId" value-key="value" :items="videoTemplateOptions" placeholder="Pick a video template" class="w-full" />
                </UFormField>
                <UButton size="sm" icon="i-lucide-clapperboard" label="Generate test video" :disabled="!testVideoTemplateId" @click="generateTestVideo" />
              </div>
            </UCard>

            <UCard v-if="lead.businessHours">
              <template #header>
                <span class="font-medium">Business hours</span>
              </template>
              <div class="flex flex-col gap-1 text-sm">
                <div v-for="(hours, day) in lead.businessHours" :key="day" class="flex justify-between">
                  <span class="text-muted">{{ day }}</span>
                  <span>{{ hours }}</span>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <UTabs v-model="activeTab" :items="tabs" variant="link">
          <template #contacts>
            <UCard>
              <div v-if="!lead.contacts.length" class="text-sm text-muted py-6 text-center">
                No contacts yet — enrichment discovers staff on the website and decision-makers via PDL/Hunter/FullEnrich.
              </div>
              <div v-else class="divide-y divide-default">
                <div v-for="c in lead.contacts" :key="c.id" class="py-3 flex items-center gap-4">
                  <UAvatar :alt="`${c.firstName} ${c.lastName}`" size="sm" />
                  <div class="flex-1">
                    <div class="font-medium text-sm">
                      {{ c.firstName }} {{ c.lastName }} <span class="text-muted font-normal">· {{ c.jobTitle ?? '—' }}</span>
                    </div>
                    <div class="text-xs text-muted">
                      {{ c.email ?? 'no email' }} · {{ c.phone ?? 'no phone' }}
                    </div>
                  </div>
                  <StatusBadge :status="c.emailStatus" />
                </div>
              </div>
            </UCard>
          </template>

          <template #emails>
            <UCard>
              <div v-if="!lead.emails.length" class="text-sm text-muted py-6 text-center">
                No emails sent to this lead yet.
              </div>
              <div v-else class="flex flex-col gap-4">
                <div v-for="e in lead.emails" :key="e.id" class="border border-default rounded-lg p-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <StatusBadge :status="e.status" />
                    <span class="font-medium text-sm flex-1">{{ e.subject }}</span>
                    <UBadge v-if="e.wasTestMode" color="warning" variant="outline" size="sm">
                      test
                    </UBadge>
                    <span class="text-xs text-muted">{{ formatDateTime(e.sentAt) }}</span>
                  </div>
                  <div class="text-xs text-muted mt-1">
                    Campaign: {{ e.campaignName ?? '—' }}
                  </div>
                  <div class="flex gap-3 mt-2 flex-wrap">
                    <span v-for="ev in e.events" :key="ev.type + ev.occurredAt" class="text-xs text-muted flex items-center gap-1">
                      <UIcon name="i-lucide-circle-check" class="size-3 text-success" />
                      {{ ev.type.toLowerCase() }} {{ formatDateTime(ev.occurredAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </UCard>
          </template>

          <template #notes>
            <UCard>
              <div class="flex gap-2 mb-4">
                <UTextarea v-model="newNote" placeholder="Add a note…" :rows="2" class="flex-1" />
                <UButton label="Add" :disabled="!newNote.trim()" @click="addNote" />
              </div>
              <div v-if="!lead.notes.length" class="text-sm text-muted py-4 text-center">
                No notes yet.
              </div>
              <div v-else class="flex flex-col gap-3">
                <div v-for="n in lead.notes" :key="n.id" class="border border-default rounded-lg p-3">
                  <div class="text-xs text-muted mb-1">
                    {{ n.author }} · {{ formatDateTime(n.createdAt) }}
                  </div>
                  <p class="text-sm whitespace-pre-wrap">
                    {{ n.body }}
                  </p>
                </div>
              </div>
            </UCard>
          </template>

          <template #costs>
            <UCard>
              <div v-if="!lead.costs.length" class="text-sm text-muted py-6 text-center">
                No costs recorded for this lead.
              </div>
              <div v-else class="divide-y divide-default">
                <div v-for="c in lead.costs" :key="c.id" class="py-2.5 flex items-center gap-3 text-sm">
                  <UBadge color="neutral" variant="outline" size="sm">
                    {{ c.type }}
                  </UBadge>
                  <span class="flex-1">{{ c.description }}</span>
                  <span class="text-muted text-xs">{{ formatDate(c.createdAt) }}</span>
                  <span class="font-medium w-16 text-right">{{ formatUsd(c.amountUsd) }}</span>
                </div>
                <div class="py-2.5 flex justify-end gap-3 text-sm font-semibold">
                  <span>Total</span><span class="w-16 text-right">{{ formatUsd(lead.totalCostUsd) }}</span>
                </div>
              </div>
            </UCard>
          </template>

          <template #activity>
            <UCard>
              <div v-if="responsesLoading" class="flex justify-center py-8">
                <UIcon name="i-lucide-loader-circle" class="animate-spin size-5 text-muted" />
              </div>
              <div v-else-if="!responses?.length" class="text-sm text-muted py-6 text-center">
                No provider calls recorded yet — they appear here after an enrichment run.
              </div>
              <div v-else class="flex flex-col gap-3">
                <div v-for="r in responses" :key="r.id" class="border border-default rounded-lg p-3 flex flex-col gap-2">
                  <div class="flex items-center gap-2 flex-wrap text-sm">
                    <UIcon :name="r.success ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" :class="r.success ? 'text-success' : 'text-error'" class="size-4" />
                    <UBadge color="neutral" variant="outline" size="sm">
                      {{ r.provider }}
                    </UBadge>
                    <span class="font-medium">{{ r.operation }}</span>
                    <span class="text-xs text-muted ms-auto">
                      {{ formatUsd(r.costUsd) }} · {{ (r.durationMs / 1000).toFixed(1) }}s · {{ formatDateTime(r.createdAt) }}
                    </span>
                  </div>
                  <p v-if="r.error" class="text-xs text-error">
                    {{ r.error }}
                  </p>
                  <div class="grid sm:grid-cols-2 gap-2">
                    <RawJson :data="r.request" label="Request" />
                    <RawJson :data="r.response" label="Response" />
                  </div>
                </div>
              </div>
            </UCard>
          </template>
        </UTabs>
      </div>
    </template>
  </UDashboardPanel>
</template>
