<script setup lang="ts">
import type { IFullenrichLiveCompany, IFullenrichLiveContact, IFullenrichLiveEnrichInput, IFullenrichLivePoll } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let cancelled = false
onBeforeUnmount(() => {
  cancelled = true
})

// FullEnrich enrich/reverse are async on the provider side: submit → poll every 3s (max ~60s).
async function pollUntilFinished(poll: () => Promise<IFullenrichLivePoll>, onStatus: (s: string) => void): Promise<IFullenrichLivePoll> {
  for (let i = 0; i < 20; i++) {
    await sleep(3000)
    if (cancelled)
      return { status: 'CANCELED', result: null }
    const res = await poll()
    onStatus(res.status)
    if (res.status === 'FINISHED' || res.status === 'CANCELED')
      return res
  }
  throw new ApiError('FullEnrich polling timed out after ~60s', 'The job may still finish — keep the enrichment ID from the raw JSON and poll again later.')
}

// ── Contact enrich (async) ──
const enrichInput = reactive<IFullenrichLiveEnrichInput>({ firstName: '', lastName: '', company: '', domain: '', linkedinUrl: '' })
const enrichLoading = ref(false)
const enrichStatus = ref<string | null>(null)
const enrichSearched = ref(false)
const enrichResult = ref<IFullenrichLiveContact | null>(null)
const enrichError = ref<ApiError | null>(null)

const enrichReady = computed(() => (enrichInput.firstName?.trim() && enrichInput.lastName?.trim()) || enrichInput.linkedinUrl?.trim())

const enrichSamples = [
  { label: 'Cassie Brewster · Franklin BBQ', apply: () => Object.assign(enrichInput, { firstName: 'Cassie', lastName: 'Brewster', company: 'Franklin Barbecue', domain: 'franklinbbq.com', linkedinUrl: '' }) },
  { label: 'John Collison · Stripe', apply: () => Object.assign(enrichInput, { firstName: 'John', lastName: 'Collison', company: 'Stripe', domain: 'stripe.com', linkedinUrl: '' }) },
]

async function enrich() {
  enrichLoading.value = true
  enrichError.value = null
  enrichStatus.value = 'submitting…'
  try {
    const cleaned = Object.fromEntries(Object.entries(toRaw(enrichInput)).filter(([, v]) => v && v.trim()))
    const { enrichmentId } = await PlaygroundApi.fullenrichEnrich(cleaned as IFullenrichLiveEnrichInput)
    enrichStatus.value = 'submitted — polling…'
    const final = await pollUntilFinished(
      () => PlaygroundApi.fullenrichEnrichResult(enrichmentId),
      s => enrichStatus.value = s,
    )
    enrichResult.value = final.result
    enrichSearched.value = true
  }
  catch (err) {
    enrichError.value = err as ApiError
  }
  finally {
    enrichLoading.value = false
    enrichStatus.value = null
  }
}

// ── Reverse email (async) ──
const reverseEmail = ref('')

const reverseSamples = [
  { label: 'cassie@franklinbbq.com', apply: () => reverseEmail.value = 'cassie@franklinbbq.com' },
]
const reverseLoading = ref(false)
const reverseStatus = ref<string | null>(null)
const reverseSearched = ref(false)
const reverseResult = ref<IFullenrichLiveContact | null>(null)
const reverseError = ref<ApiError | null>(null)

async function reverse() {
  reverseLoading.value = true
  reverseError.value = null
  reverseStatus.value = 'submitting…'
  try {
    const { enrichmentId } = await PlaygroundApi.fullenrichReverseEmail(reverseEmail.value.trim())
    reverseStatus.value = 'submitted — polling…'
    const final = await pollUntilFinished(
      () => PlaygroundApi.fullenrichReverseEmailResult(enrichmentId),
      s => reverseStatus.value = s,
    )
    reverseResult.value = final.result
    reverseSearched.value = true
  }
  catch (err) {
    reverseError.value = err as ApiError
  }
  finally {
    reverseLoading.value = false
    reverseStatus.value = null
  }
}

// ── People search (sync, free) ──
const peopleInput = reactive({ company: '', domain: '', city: '', state: '', limit: 10 })

const peopleSamples = [
  { label: 'Franklin Barbecue', apply: () => Object.assign(peopleInput, { company: 'Franklin Barbecue', domain: 'franklinbbq.com', city: '', state: '' }) },
  { label: 'Voodoo Doughnut', apply: () => Object.assign(peopleInput, { company: 'Voodoo Doughnut', domain: 'voodoodoughnut.com', city: '', state: '' }) },
]
const peopleLoading = ref(false)
const peopleSearched = ref(false)
const peopleResult = ref<Array<IFullenrichLiveContact> | null>(null)
const peopleError = ref<ApiError | null>(null)

async function searchPeople() {
  peopleLoading.value = true
  peopleError.value = null
  try {
    const raw = toRaw(peopleInput)
    const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' || (typeof v === 'string' && v.trim())))
    peopleResult.value = await PlaygroundApi.fullenrichSearchPeople(cleaned)
    peopleSearched.value = true
  }
  catch (err) {
    peopleError.value = err as ApiError
  }
  finally {
    peopleLoading.value = false
  }
}

// ── Company search (sync, free) ──
const companyInput = reactive({ name: '', domain: '', city: '', state: '' })

// Note: company search found Stripe but NOT the small BBQ shop in live testing —
// FullEnrich's company index skews bigger/B2B.
const companySamples = [
  { label: 'Stripe', apply: () => Object.assign(companyInput, { name: 'Stripe', domain: 'stripe.com', city: '', state: '' }) },
  { label: 'Franklin Barbecue (no match)', apply: () => Object.assign(companyInput, { name: 'Franklin Barbecue', domain: '', city: 'Austin', state: 'TX' }) },
]
const companyLoading = ref(false)
const companySearched = ref(false)
const companyResult = ref<IFullenrichLiveCompany | null>(null)
const companyError = ref<ApiError | null>(null)

async function searchCompany() {
  companyLoading.value = true
  companyError.value = null
  try {
    const raw = toRaw(companyInput)
    const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v && v.trim()))
    companyResult.value = await PlaygroundApi.fullenrichSearchCompany(cleaned as { name: string })
    companySearched.value = true
  }
  catch (err) {
    companyError.value = err as ApiError
  }
  finally {
    companyLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-fullenrich">
    <template #header>
      <UDashboardNavbar title="Playground — FullEnrich">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <!-- Contact enrich -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Contact enrich <span class="text-xs text-muted font-normal">(async — submits then polls ~30s)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="enrichSamples" />
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="First name">
                  <UInput v-model="enrichInput.firstName" placeholder="Sarah" />
                </UFormField>
                <UFormField label="Last name">
                  <UInput v-model="enrichInput.lastName" placeholder="Mitchell" />
                </UFormField>
              </div>
              <UFormField label="Company name">
                <UInput v-model="enrichInput.company" placeholder="Lonestar Dental Care" class="w-full" />
              </UFormField>
              <UFormField label="Company domain">
                <UInput v-model="enrichInput.domain" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <UFormField label="LinkedIn URL">
                <UInput v-model="enrichInput.linkedinUrl" placeholder="https://linkedin.com/in/…" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-layers" label="Enrich (submit + poll)" :loading="enrichLoading" :disabled="!enrichReady" class="self-start" @click="enrich" />
              <p v-if="enrichStatus" class="text-xs text-muted flex items-center gap-1.5">
                <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" /> {{ enrichStatus }}
              </p>
              <p class="text-xs text-dimmed">
                Live call — $0.07 per matched contact. The last resort of the waterfall.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="enrichError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="enrichError.message" :description="enrichError.info ?? undefined" />
            <UCard v-if="enrichSearched && !enrichResult && !enrichError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-user-x" class="size-5" />
                No usable match (confidence 0).
              </div>
            </UCard>
            <UCard v-if="enrichResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ [enrichResult.firstName, enrichResult.lastName].filter(Boolean).join(' ') || 'Match found' }}</span>
                  <UBadge :color="enrichResult.confidence >= 7 ? 'success' : 'warning'" variant="subtle" size="sm">
                    confidence {{ enrichResult.confidence }}/10
                  </UBadge>
                </div>
                <div>
                  <span class="text-muted text-xs block">Work email</span>{{ enrichResult.workEmail ?? '—' }}
                  <UBadge v-if="enrichResult.workEmailStatus" color="neutral" variant="outline" size="sm">
                    {{ enrichResult.workEmailStatus }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Personal email / phones</span>{{ enrichResult.personalEmail ?? '—' }} · {{ enrichResult.phones.length ? enrichResult.phones.join(', ') : '—' }}</div>
                <div><span class="text-muted text-xs block">Title / LinkedIn</span>{{ enrichResult.jobTitle ?? '—' }} · {{ enrichResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="enrichResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- Reverse email -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Reverse email lookup <span class="text-xs text-muted font-normal">(async — email → person)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="reverseSamples" />
              <UFormField label="Email">
                <UInput v-model="reverseEmail" placeholder="sarah@lonestardental.com" class="w-full" @keydown.enter="reverseEmail.trim() && reverse()" />
              </UFormField>
              <UButton icon="i-lucide-at-sign" label="Look up (submit + poll)" :loading="reverseLoading" :disabled="!reverseEmail.trim()" class="self-start" @click="reverse" />
              <p v-if="reverseStatus" class="text-xs text-muted flex items-center gap-1.5">
                <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" /> {{ reverseStatus }}
              </p>
              <p class="text-xs text-dimmed">
                Live call — $0.03 per lookup. Returns name + LinkedIn even without a work email.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="reverseError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="reverseError.message" :description="reverseError.info ?? undefined" />
            <UCard v-if="reverseSearched && !reverseResult && !reverseError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-user-x" class="size-5" />
                No person found for that email.
              </div>
            </UCard>
            <UCard v-if="reverseResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ [reverseResult.firstName, reverseResult.lastName].filter(Boolean).join(' ') || 'Match found' }}</span>
                  <UBadge color="neutral" variant="outline" size="sm">
                    {{ reverseResult.jobTitle ?? 'no title' }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">LinkedIn</span>{{ reverseResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="reverseResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- People search -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">People search <span class="text-xs text-muted font-normal">(sync, free — profiles only, no emails)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="peopleSamples" />
              <UFormField label="Company name">
                <UInput v-model="peopleInput.company" placeholder="Lonestar Dental Care" class="w-full" />
              </UFormField>
              <UFormField label="Company domain">
                <UInput v-model="peopleInput.domain" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="City">
                  <UInput v-model="peopleInput.city" placeholder="Austin" />
                </UFormField>
                <UFormField label="State">
                  <UInput v-model="peopleInput.state" placeholder="TX" />
                </UFormField>
              </div>
              <UButton icon="i-lucide-users-round" label="Search people" :loading="peopleLoading" :disabled="!peopleInput.company.trim() && !peopleInput.domain.trim()" class="self-start" @click="searchPeople" />
              <p class="text-xs text-dimmed">
                Free — the old flow's fallback when PDL finds nobody.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="peopleError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="peopleError.message" :description="peopleError.info ?? undefined" />
            <template v-if="peopleResult">
              <div class="text-sm text-muted">
                {{ peopleResult.length }} found
              </div>
              <UCard v-if="peopleResult.length === 0">
                <div class="text-sm text-muted flex items-center gap-2">
                  <UIcon name="i-lucide-user-x" class="size-5" />
                  Nobody found at that company.
                </div>
              </UCard>
              <div v-else class="border border-default rounded-lg divide-y divide-default">
                <div v-for="(p, i) in peopleResult" :key="i" class="p-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ [p.firstName, p.lastName].filter(Boolean).join(' ') }}</span>
                    <UBadge v-if="p.jobTitle" color="neutral" variant="outline" size="sm">
                      {{ p.jobTitle }}
                    </UBadge>
                  </div>
                  <div class="text-xs text-muted mt-1">
                    {{ p.linkedinUrl ?? 'no LinkedIn' }}
                  </div>
                </div>
              </div>
              <RawJson :data="peopleResult" />
            </template>
          </div>
        </div>

        <USeparator />

        <!-- Company search -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Company search <span class="text-xs text-muted font-normal">(sync, free — best match)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="companySamples" />
              <UFormField label="Company name">
                <UInput v-model="companyInput.name" placeholder="Lonestar Dental Care" class="w-full" @keydown.enter="companyInput.name.trim() && searchCompany()" />
              </UFormField>
              <UFormField label="Domain">
                <UInput v-model="companyInput.domain" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="City">
                  <UInput v-model="companyInput.city" placeholder="Austin" />
                </UFormField>
                <UFormField label="State">
                  <UInput v-model="companyInput.state" placeholder="TX" />
                </UFormField>
              </div>
              <UButton icon="i-lucide-building-2" label="Search company" :loading="companyLoading" :disabled="!companyInput.name.trim()" class="self-start" @click="searchCompany" />
              <p class="text-xs text-dimmed">
                Free — the old flow's fallback when PDL can't enrich the company.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="companyError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="companyError.message" :description="companyError.info ?? undefined" />
            <UCard v-if="companySearched && !companyResult && !companyError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-5" />
                No company found.
              </div>
            </UCard>
            <UCard v-if="companyResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ companyResult.name ?? '—' }}</span>
                  <UBadge v-if="companyResult.industry" color="neutral" variant="outline" size="sm">
                    {{ companyResult.industry }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Domain / employees</span>{{ companyResult.domain ?? '—' }} · {{ companyResult.employeeCount ?? '—' }}</div>
                <div><span class="text-muted text-xs block">LinkedIn</span>{{ companyResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="companyResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
