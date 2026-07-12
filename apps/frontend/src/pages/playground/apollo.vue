<script setup lang="ts">
import type { IApolloLiveInput, IApolloLiveOrg, IApolloLiveResult } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// ── Company match (works even where person match is plan-gated) ─────────────
const orgDomain = ref('')
const orgLoading = ref(false)
const orgSearched = ref(false)
const orgResult = ref<IApolloLiveOrg | null>(null)
const orgError = ref<ApiError | null>(null)

async function matchOrganization() {
  orgLoading.value = true
  orgError.value = null
  try {
    orgResult.value = await PlaygroundApi.apolloOrganization(orgDomain.value.trim())
    orgSearched.value = true
  }
  catch (err) {
    orgError.value = err as ApiError
  }
  finally {
    orgLoading.value = false
  }
}

const input = reactive<IApolloLiveInput>({
  firstName: '',
  lastName: '',
  organizationName: '',
  domain: '',
  email: '',
  linkedinUrl: '',
})

const loading = ref(false)
const searched = ref(false)
const result = ref<IApolloLiveResult | null>(null)
const error = ref<ApiError | null>(null)

const hasInput = computed(() => Object.values(input).some(v => v && v.trim()))

const orgSamples = [
  { label: 'franklinbbq.com', apply: () => orgDomain.value = 'franklinbbq.com' },
  { label: 'stripe.com', apply: () => orgDomain.value = 'stripe.com' },
  { label: 'apollo.io', apply: () => orgDomain.value = 'apollo.io' },
]

const personSamples = [
  { label: 'Cassie Brewster · Franklin BBQ', apply: () => Object.assign(input, { firstName: 'Cassie', lastName: 'Brewster', organizationName: 'Franklin Barbecue', domain: 'franklinbbq.com', email: '', linkedinUrl: '' }) },
  { label: 'John Collison · Stripe', apply: () => Object.assign(input, { firstName: 'John', lastName: 'Collison', organizationName: 'Stripe', domain: 'stripe.com', email: '', linkedinUrl: '' }) },
]

async function match() {
  loading.value = true
  error.value = null
  try {
    const cleaned = Object.fromEntries(Object.entries(input).filter(([, v]) => v && v.trim()))
    result.value = await PlaygroundApi.apolloMatch(cleaned)
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
  <UDashboardPanel id="playground-apollo">
    <template #header>
      <UDashboardNavbar title="Playground — Apollo">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <UAlert
          color="warning" variant="subtle" icon="i-lucide-triangle-alert"
          title="⚠️ Partially working (live test 2026-07-12) — person match is plan-gated"
          description="Company match works. Person match returns 403: “api/v1/people/match is not accessible with this api_key on a free plan.” Fix: upgrade the Apollo plan at app.apollo.io to test person match — no code change needed. PDL covers this role in the waterfall meanwhile."
        />

        <!-- Company match -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Company match <span class="text-xs text-muted font-normal">(by domain)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="orgSamples" />
              <UFormField label="Domain">
                <UInput v-model="orgDomain" placeholder="lonestardental.com" class="w-full" @keydown.enter="matchOrganization" />
              </UFormField>
              <UButton icon="i-lucide-building-2" label="Match company" :loading="orgLoading" :disabled="!orgDomain.trim()" class="self-start" @click="matchOrganization" />
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="orgError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="orgError.message" :description="orgError.info ?? undefined" />
            <UCard v-if="orgSearched && !orgResult && !orgError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-5" />
                No company found for that domain.
              </div>
            </UCard>
            <UCard v-if="orgResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ orgResult.name }}</span>
                  <UBadge v-if="orgResult.industry" color="neutral" variant="outline" size="sm">
                    {{ orgResult.industry }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Employees / revenue / founded</span>{{ orgResult.employeeCount ?? '—' }} · {{ orgResult.annualRevenue ? formatUsd(orgResult.annualRevenue) : '—' }} · {{ orgResult.foundedYear ?? '—' }}</div>
                <div><span class="text-muted text-xs block">Location</span>{{ [orgResult.city, orgResult.state].filter(Boolean).join(', ') || '—' }}</div>
                <div><span class="text-muted text-xs block">Phone / LinkedIn</span>{{ orgResult.phone ?? '—' }} · {{ orgResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="orgResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <div class="grid lg:grid-cols-2 gap-6">
        <UCard>
          <template #header>
            <span class="font-medium">Person match <span class="text-xs text-muted font-normal">(currently plan-gated — kept for when the plan upgrades)</span></span>
          </template>
          <div class="flex flex-col gap-3">
            <SampleChips :samples="personSamples" />
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="First name">
                <UInput v-model="input.firstName" placeholder="Sarah" />
              </UFormField>
              <UFormField label="Last name">
                <UInput v-model="input.lastName" placeholder="Mitchell" />
              </UFormField>
            </div>
            <UFormField label="Company name">
              <UInput v-model="input.organizationName" placeholder="Lonestar Dental Care" class="w-full" />
            </UFormField>
            <UFormField label="Domain">
              <UInput v-model="input.domain" placeholder="lonestardental.com" class="w-full" />
            </UFormField>
            <UFormField label="Email (reverse lookup)">
              <UInput v-model="input.email" placeholder="sarah@…" class="w-full" />
            </UFormField>
            <UFormField label="LinkedIn URL">
              <UInput v-model="input.linkedinUrl" placeholder="https://linkedin.com/in/…" class="w-full" />
            </UFormField>
            <UButton icon="i-lucide-user-search" label="Match live" :loading="loading" :disabled="!hasInput" class="self-start" @click="match" />
            <p class="text-xs text-dimmed">
              Live call — a successful match consumes an Apollo credit.
            </p>
          </div>
        </UCard>

        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <UCard v-if="searched && !result && !error">
            <div class="text-sm text-muted flex items-center gap-2">
              <UIcon name="i-lucide-user-x" class="size-5" />
              No match found (or the matched email was invalid).
            </div>
          </UCard>

          <UCard v-if="result">
            <div class="flex flex-col gap-2 text-sm">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                <span class="font-medium">Match found</span>
                <UBadge :color="result.confidence >= 9 ? 'success' : 'warning'" variant="subtle" size="sm">
                  confidence {{ result.confidence }}/10
                </UBadge>
              </div>
              <div><span class="text-muted text-xs block">Work email</span>{{ result.workEmail ?? '—' }} <UBadge v-if="result.emailStatus" color="neutral" variant="outline" size="sm">{{ result.emailStatus }}</UBadge></div>
              <div><span class="text-muted text-xs block">Title</span>{{ result.jobTitle ?? '—' }} · {{ result.seniority ?? '—' }} · {{ result.department ?? '—' }}</div>
              <div><span class="text-muted text-xs block">Phones</span>{{ result.phones.length ? result.phones.join(', ') : '—' }}</div>
              <div><span class="text-muted text-xs block">LinkedIn</span>{{ result.linkedinUrl ?? '—' }}</div>
              <div><span class="text-muted text-xs block">Likely to engage</span>{{ result.isLikelyToEngage === null ? '—' : result.isLikelyToEngage ? 'yes' : 'no' }}</div>
            </div>
            <RawJson :data="result.raw" class="mt-3" />
          </UCard>

          <div v-if="!searched && !error" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
            Fill any combination (name + domain works best) and match.
          </div>
        </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
