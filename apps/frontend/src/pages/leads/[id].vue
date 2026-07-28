<script setup lang="ts">
import type { IEnrichmentResponse } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { LeadsApi } from '~/app/api/leads.api'
import { TemplatesApi } from '~/app/api/templates.api'
import { VideosApi } from '~/app/api/video.api'

const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const { data: lead, status, refresh } = await useAsyncData(`leads.${id}`, () => LeadsApi.get(id))
const { data: templates } = await useAsyncData('templates.list', () => TemplatesApi.list())

// Generate a video from a video template (test = watermarked/free, real = paid render).
const videoTemplateOptions = computed(() => (templates.value ?? [])
  .filter(t => t.videoScript !== null || t.heygenTemplateId)
  .map(t => ({ label: t.name, value: t.id })))
const videoTemplateId = ref<string | undefined>()
const realRender = ref(false)
const generatingVideo = ref(false)

async function generateVideo() {
  if (!videoTemplateId.value)
    return
  generatingVideo.value = true
  try {
    await VideosApi.generate(id, videoTemplateId.value, !realRender.value)
    toast.add({ title: realRender.value ? 'Video queued (real render)' : 'Test video queued', description: 'HeyGen is rendering — it appears in the Videos tab once the scheduler downloads it (~5 min after completion).', color: 'success' })
    await refresh()
  }
  catch (err) {
    toast.add({ title: 'Could not queue video', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    generatingVideo.value = false
  }
}

function copyVideoLink(token: string) {
  navigator.clipboard.writeText(`${location.origin}/v/${token}`)
  toast.add({ title: 'Public video link copied', color: 'success' })
}

// Manual recheck for PROCESSING renders — local dev has no cron to poll HeyGen.
const pollingVideos = ref(false)
async function pollVideos() {
  pollingVideos.value = true
  try {
    const s = await VideosApi.poll()
    await refresh()
    toast.add({
      title: `${s.completed} completed · ${s.failed} failed · ${s.processing} still rendering`,
      color: s.failed ? 'warning' : 'success',
    })
  }
  catch (err) {
    toast.add({ title: 'Could not check videos', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    pollingVideos.value = false
  }
}
const hasProcessingVideos = computed(() => (lead.value?.videos ?? []).some(v => v.status === 'PROCESSING' || v.status === 'PENDING'))

// ── Outreach email (AI decision-maker pick, S4b) ──
const pickingEmail = ref(false)
async function pickOutreachEmail(force: boolean) {
  pickingEmail.value = true
  try {
    const result = await LeadsApi.pickOutreachEmail(id, force)
    await refresh()
    toast.add({
      title: result.picked ? `Outreach email: ${result.email}` : 'No email picked',
      description: result.reason ?? undefined,
      color: result.picked ? 'success' : 'warning',
    })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Pick failed', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    pickingEmail.value = false
  }
}

const editingOutreach = ref(false)
const outreachDraft = ref('')
const outreachOptions = computed(() => {
  const emails = new Set<string>()
  for (const c of lead.value?.contacts ?? []) {
    if (c.email)
      emails.add(c.email)
  }
  if (lead.value?.email)
    emails.add(lead.value.email)
  return [...emails]
})

async function saveOutreachEmail() {
  try {
    await LeadsApi.update(id, { outreachEmail: outreachDraft.value.trim() || null })
    editingOutreach.value = false
    await refresh()
    toast.add({ title: 'Outreach email saved', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: (err as ApiError).message, color: 'error' })
  }
}

// ── Konci platform registration (test account + claim link) ──
// While the pipeline runs (~80s) re-fetch the lead every 15s so the status flips to
// PREPARED without clicking. The refresh traffic also drives the API's dev self-tick.
onMounted(() => {
  const timer = setInterval(() => {
    if (lead.value?.konciRegistration?.status === 'PENDING')
      refresh()
  }, 15_000)
  onUnmounted(() => clearInterval(timer))
})

const konciBusy = ref(false)
async function konciAction(fn: () => Promise<unknown>, successTitle: string) {
  konciBusy.value = true
  try {
    await fn()
    await refresh()
    toast.add({ title: successTitle, color: 'success' })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Konci action failed', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    konciBusy.value = false
  }
}

function copyClaimUrl() {
  if (!lead.value?.konciRegistration?.claimUrl)
    return
  navigator.clipboard.writeText(lead.value.konciRegistration.claimUrl)
  toast.add({ title: 'Claim link copied', color: 'success' })
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
  { label: 'Videos', slot: 'videos', icon: 'i-lucide-video' },
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
                <div class="flex items-center justify-between">
                  <span class="font-medium">Outreach email</span>
                  <UButton
                    size="xs" icon="i-lucide-sparkles" color="neutral" variant="ghost"
                    :label="lead.outreachEmail ? 'Re-pick (AI)' : 'Pick (AI)'"
                    :loading="pickingEmail" @click="pickOutreachEmail(!!lead.outreachEmail)"
                  />
                </div>
              </template>
              <div class="flex flex-col gap-2 text-sm">
                <template v-if="!editingOutreach">
                  <div class="flex items-center gap-2">
                    <span class="font-mono" :class="{ 'text-muted': !lead.outreachEmail }">{{ lead.outreachEmail ?? 'not set — sync falls back to best contact' }}</span>
                    <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" aria-label="Edit" @click="outreachDraft = lead.outreachEmail ?? ''; editingOutreach = true" />
                  </div>
                  <p v-if="lead.outreachEmailReason" class="text-xs text-muted italic">
                    {{ lead.outreachEmailReason }}
                  </p>
                </template>
                <template v-else>
                  <UInputMenu v-model="outreachDraft" :items="outreachOptions" create-item class="w-full" placeholder="who@business.com" @create="(v: string) => outreachDraft = v" />
                  <div class="flex gap-1.5">
                    <UButton size="xs" label="Save" @click="saveOutreachEmail" />
                    <UButton size="xs" color="neutral" variant="ghost" label="Cancel" @click="editingOutreach = false" />
                  </div>
                </template>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-medium">Konci platform</span>
                  <StatusBadge v-if="lead.konciRegistration" :status="lead.konciRegistration.status" />
                </div>
              </template>
              <div class="flex flex-col gap-3">
                <!-- Test-account registration (required before Smartlead sync) -->
                <div v-if="!lead.konciRegistration" class="flex flex-col gap-2">
                  <p class="text-xs text-muted">
                    No Konci test account yet — required before this lead can be sent.
                    Registered automatically when the lead joins a list, or now:
                  </p>
                  <UButton size="sm" icon="i-lucide-rocket" label="Create Konci account" :loading="konciBusy" :disabled="!lead.website" @click="konciAction(() => LeadsApi.konciRegister(lead!.id), 'Konci registration started — pipeline takes ~80s')" />
                  <p v-if="!lead.website" class="text-xs text-error">
                    Needs a website on the lead first.
                  </p>
                </div>
                <div v-else class="flex flex-col gap-2 text-sm">
                  <div v-if="lead.konciRegistration.claimUrl" class="flex items-center gap-1.5 min-w-0">
                    <a :href="lead.konciRegistration.claimUrl" target="_blank" class="text-primary text-xs truncate flex-1">{{ lead.konciRegistration.claimUrl }}</a>
                    <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" aria-label="Copy claim link" @click="copyClaimUrl" />
                  </div>
                  <p class="text-xs text-muted">
                    <template v-if="lead.konciRegistration.claimExpiresAt">Claim expires {{ formatDateTime(lead.konciRegistration.claimExpiresAt) }} · </template>
                    last checked {{ lead.konciRegistration.lastPolledAt ? formatDateTime(lead.konciRegistration.lastPolledAt) : 'never' }}
                  </p>
                  <UAlert v-if="lead.konciRegistration.error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :description="lead.konciRegistration.error" />
                  <div class="flex gap-1.5 flex-wrap">
                    <UButton v-if="lead.konciRegistration.status === 'PENDING'" size="xs" icon="i-lucide-refresh-cw" color="neutral" variant="outline" label="Check status" :loading="konciBusy" @click="konciAction(() => LeadsApi.konciRefresh(lead!.id), 'Status refreshed')" />
                    <UButton v-if="['FAILED', 'NEEDS_PHONE', 'SKIPPED'].includes(lead.konciRegistration.status)" size="xs" icon="i-lucide-rotate-ccw" color="warning" variant="outline" label="Retry pipeline" :loading="konciBusy" @click="konciAction(() => LeadsApi.konciRetry(lead!.id), 'Pipeline re-running — takes ~80s')" />
                    <UButton v-if="lead.konciRegistration.status === 'PREPARED'" size="xs" icon="i-lucide-link" color="neutral" variant="outline" label="New claim link" :loading="konciBusy" @click="konciAction(() => LeadsApi.konciClaimLink(lead!.id), 'Fresh claim link minted')" />
                  </div>
                </div>

                <USeparator />
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
                <div class="flex items-center justify-between">
                  <span class="font-medium">Outreach video</span>
                  <UBadge v-if="lead.videoUrl" color="success" variant="subtle" size="sm">
                    ready
                  </UBadge>
                </div>
              </template>
              <div class="flex flex-col gap-3">
                <a v-if="lead.videoUrl" :href="lead.videoUrl" target="_blank" class="block">
                  <img
                    v-if="lead.videoThumbnailUrl" :src="lead.videoThumbnailUrl" alt="Outreach video thumbnail"
                    class="rounded-lg w-full object-cover"
                  >
                  <span v-else class="text-sm text-primary">{{ lead.videoUrl }}</span>
                </a>
                <p v-if="lead.videoUrl" class="text-xs text-muted">
                  Synced to Smartlead as <code class="font-mono">video_url</code> / <code class="font-mono">video_thumbnail</code>.
                </p>
                <UFormField label="Template" size="sm">
                  <USelectMenu v-model="videoTemplateId" value-key="value" :items="videoTemplateOptions" placeholder="Pick a video template" class="w-full" />
                </UFormField>
                <UCheckbox v-model="realRender" label="Real render (uses HeyGen credits, ~$0.50)" />
                <UButton
                  size="sm" icon="i-lucide-clapperboard"
                  :label="realRender ? 'Generate video ($)' : 'Generate test video (free, watermarked)'"
                  :color="realRender ? 'warning' : 'primary'"
                  :loading="generatingVideo" :disabled="!videoTemplateId" @click="generateVideo"
                />
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

          <template #videos>
            <UCard>
              <template v-if="hasProcessingVideos" #header>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">Renders in progress — HeyGen usually takes a few minutes.</span>
                  <UButton
                    size="xs" icon="i-lucide-refresh-cw" color="neutral" variant="outline"
                    label="Check status now" :loading="pollingVideos" @click="pollVideos"
                  />
                </div>
              </template>
              <div v-if="!lead.videos.length" class="text-sm text-muted py-6 text-center">
                No videos yet — pick a template in the “Outreach video” card and generate one.
              </div>
              <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="v in lead.videos" :key="v.id" class="bg-elevated/40 rounded-xl overflow-hidden flex flex-col">
                  <a v-if="v.status === 'COMPLETED'" :href="`/v/${v.token}`" target="_blank" class="block relative group">
                    <img
                      v-if="v.hasThumbnail" :src="VideosApi.thumbUrl(v.token)" alt="Video thumbnail"
                      class="aspect-video object-cover w-full bg-elevated"
                    >
                    <div v-else class="aspect-video w-full bg-elevated flex items-center justify-center">
                      <UIcon name="i-lucide-video" class="size-8 text-muted" />
                    </div>
                    <div class="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition">
                      <UIcon name="i-lucide-circle-play" class="size-10 text-white drop-shadow" />
                    </div>
                  </a>
                  <div v-else class="aspect-video w-full bg-elevated flex flex-col items-center justify-center gap-1">
                    <UIcon :name="v.status === 'FAILED' ? 'i-lucide-circle-x' : 'i-lucide-loader-circle'" :class="v.status === 'FAILED' ? 'text-error' : 'animate-spin text-muted'" class="size-6" />
                    <span v-if="v.error" class="text-xs text-error px-3 text-center">{{ v.error }}</span>
                  </div>
                  <div class="p-3 flex flex-col gap-1.5 text-sm">
                    <div class="flex items-center gap-2 flex-wrap">
                      <StatusBadge :status="v.status" />
                      <UBadge v-if="v.isTest" color="warning" variant="outline" size="sm">
                        test
                      </UBadge>
                      <UBadge v-if="lead.videoUrl?.endsWith(v.token)" color="success" variant="subtle" size="sm">
                        outreach video
                      </UBadge>
                    </div>
                    <div class="text-xs text-muted">
                      {{ v.templateName ?? '—' }} · {{ v.durationSeconds ? `${v.durationSeconds}s` : '…' }} · {{ formatDate(v.createdAt) }}
                    </div>
                    <div v-if="v.status === 'COMPLETED'" class="flex gap-1.5 mt-1">
                      <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-external-link" label="Watch" :to="`/v/${v.token}`" target="_blank" />
                      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" label="Copy link" @click="copyVideoLink(v.token)" />
                    </div>
                  </div>
                </div>
              </div>
            </UCard>
          </template>

          <template #emails>
            <UCard v-if="lead.outreachStats.length" class="mb-4">
              <template #header>
                <span class="font-medium">Smartlead outreach</span>
              </template>
              <div class="divide-y divide-default">
                <div v-for="st in lead.outreachStats" :key="st.externalCampaignId + st.sequenceNumber" class="py-2.5 flex items-center gap-2 flex-wrap text-sm">
                  <UBadge color="neutral" variant="outline" size="sm">
                    step {{ st.sequenceNumber }}
                  </UBadge>
                  <span class="font-mono text-xs">{{ st.email }}</span>
                  <span v-if="st.sentAt" class="text-xs text-muted">sent {{ formatDateTime(st.sentAt) }}</span>
                  <UBadge v-if="st.openCount" color="warning" variant="subtle" size="sm">
                    {{ st.openCount }} opens
                  </UBadge>
                  <UBadge v-if="st.clickCount" color="warning" variant="subtle" size="sm">
                    {{ st.clickCount }} clicks
                  </UBadge>
                  <UBadge v-if="st.repliedAt" color="success" variant="subtle" size="sm">
                    replied {{ formatDateTime(st.repliedAt) }}
                  </UBadge>
                  <UBadge v-if="st.bounced" color="error" variant="subtle" size="sm">
                    bounced
                  </UBadge>
                </div>
              </div>
            </UCard>
            <UCard>
              <div v-if="!lead.emails.length" class="text-sm text-muted py-6 text-center">
                No emails sent to this lead yet<span v-if="lead.outreachStats.length"> from the old internal sender</span>.
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
