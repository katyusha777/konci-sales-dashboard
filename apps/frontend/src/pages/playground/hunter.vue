<script setup lang="ts">
import type { IHunterLiveDomainSearch, IHunterLiveEmail } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// ── Email finder ──
const finder = reactive({ firstName: '', lastName: '', domain: '' })
const finderLoading = ref(false)
const finderSearched = ref(false)
const finderResult = ref<IHunterLiveEmail | null>(null)
const finderError = ref<ApiError | null>(null)

const finderReady = computed(() => finder.firstName.trim() && finder.lastName.trim() && finder.domain.trim())

const finderSamples = [
  { label: 'Cassie Brewster · franklinbbq.com', apply: () => Object.assign(finder, { firstName: 'Cassie', lastName: 'Brewster', domain: 'franklinbbq.com' }) },
  { label: 'John Collison · stripe.com', apply: () => Object.assign(finder, { firstName: 'John', lastName: 'Collison', domain: 'stripe.com' }) },
]

async function findEmail() {
  finderLoading.value = true
  finderError.value = null
  try {
    finderResult.value = await PlaygroundApi.hunterFindEmail({
      firstName: finder.firstName.trim(),
      lastName: finder.lastName.trim(),
      domain: finder.domain.trim(),
    })
    finderSearched.value = true
  }
  catch (err) {
    finderError.value = err as ApiError
  }
  finally {
    finderLoading.value = false
  }
}

// ── Domain search ──
const domainForm = reactive({ domain: '', limit: 10, type: 'personal' as 'personal' | 'generic' | 'all' })

const domainSamples = [
  { label: 'franklinbbq.com', apply: () => domainForm.domain = 'franklinbbq.com' },
  { label: 'voodoodoughnut.com', apply: () => domainForm.domain = 'voodoodoughnut.com' },
]
const domainLoading = ref(false)
const domainResult = ref<IHunterLiveDomainSearch | null>(null)
const domainError = ref<ApiError | null>(null)

async function domainSearch() {
  domainLoading.value = true
  domainError.value = null
  try {
    domainResult.value = await PlaygroundApi.hunterDomainSearch({ ...toRaw(domainForm), domain: domainForm.domain.trim() })
  }
  catch (err) {
    domainError.value = err as ApiError
  }
  finally {
    domainLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-hunter">
    <template #header>
      <UDashboardNavbar title="Playground — Hunter.io">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <!-- Email finder -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Email finder <span class="text-xs text-muted font-normal">(name + domain → email)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="finderSamples" />
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="First name">
                  <UInput v-model="finder.firstName" placeholder="Sarah" />
                </UFormField>
                <UFormField label="Last name">
                  <UInput v-model="finder.lastName" placeholder="Mitchell" />
                </UFormField>
              </div>
              <UFormField label="Domain" hint="the business's own domain — not a booking platform">
                <UInput v-model="finder.domain" placeholder="lonestardental.com" class="w-full" @keydown.enter="finderReady && findEmail()" />
              </UFormField>
              <UButton icon="i-lucide-at-sign" label="Find email" :loading="finderLoading" :disabled="!finderReady" class="self-start" @click="findEmail" />
              <p class="text-xs text-dimmed">
                Live call — $0.017, charged only when an email is found.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="finderError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="finderError.message" :description="finderError.info ?? undefined" />
            <UCard v-if="finderSearched && !finderResult && !finderError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-mail-x" class="size-5" />
                No email found (not charged).
              </div>
            </UCard>
            <UCard v-if="finderResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ finderResult.email }}</span>
                  <UBadge :color="finderResult.confidence >= 7 ? 'success' : 'warning'" variant="subtle" size="sm">
                    confidence {{ finderResult.rawConfidence }}/100
                  </UBadge>
                </div>
                <div v-if="finderResult.sources.length">
                  <span class="text-muted text-xs block">Found on</span>
                  <div class="text-xs text-muted truncate">
                    {{ finderResult.sources.slice(0, 3).join(' · ') }}
                  </div>
                </div>
              </div>
              <RawJson :data="finderResult.raw" class="mt-3" />
            </UCard>
            <div v-if="!finderSearched && !finderError" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
              The cheap step of the contact waterfall — try it before PDL/FullEnrich.
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Domain search -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Domain search <span class="text-xs text-muted font-normal">(all known emails at a domain)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="domainSamples" />
              <UFormField label="Domain">
                <UInput v-model="domainForm.domain" placeholder="lonestardental.com" class="w-full" @keydown.enter="domainForm.domain.trim() && domainSearch()" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Limit">
                  <USelect v-model="domainForm.limit" :items="[10, 25, 50, 100]" class="w-full" />
                </UFormField>
                <UFormField label="Type">
                  <USelect v-model="domainForm.type" :items="['personal', 'generic', 'all']" class="w-full" />
                </UFormField>
              </div>
              <UButton icon="i-lucide-globe" label="Search domain" :loading="domainLoading" :disabled="!domainForm.domain.trim()" class="self-start" @click="domainSearch" />
              <p class="text-xs text-dimmed">
                Live call — 1 Hunter credit per request. "personal" skips info@/support@.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="domainError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="domainError.message" :description="domainError.info ?? undefined" />
            <template v-if="domainResult">
              <div class="text-sm text-muted flex items-center gap-2">
                {{ domainResult.emails.length }} emails
                <UBadge v-if="domainResult.pattern" color="neutral" variant="outline" size="sm">
                  pattern: {{ domainResult.pattern }}
                </UBadge>
              </div>
              <UCard v-if="domainResult.emails.length === 0">
                <div class="text-sm text-muted flex items-center gap-2">
                  <UIcon name="i-lucide-mail-x" class="size-5" />
                  No emails known for that domain.
                </div>
              </UCard>
              <div v-else class="border border-default rounded-lg divide-y divide-default">
                <div v-for="e in domainResult.emails" :key="e.value" class="p-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ e.value }}</span>
                    <UBadge :color="e.type === 'personal' ? 'success' : 'neutral'" variant="subtle" size="sm">
                      {{ e.type }}
                    </UBadge>
                    <UBadge v-if="e.verificationStatus" color="neutral" variant="outline" size="sm">
                      {{ e.verificationStatus }}
                    </UBadge>
                    <span class="text-xs text-muted ms-auto">{{ e.confidence }}/100</span>
                  </div>
                  <div class="text-xs text-muted mt-1">
                    {{ [e.firstName, e.lastName].filter(Boolean).join(' ') || 'no name' }}
                    · {{ e.position ?? 'no title' }} · {{ e.linkedinUrl ?? 'no LinkedIn' }}
                  </div>
                </div>
              </div>
              <RawJson :data="domainResult.raw" />
            </template>
            <div v-else-if="!domainError" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
              Useful for small firms where the exact contact name is uncertain.
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
