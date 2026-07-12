<script setup lang="ts">
import type { IJambonzLiveTrial } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// Read-only pool + agents — free, verified calls; load on page open.
const { data: numbers, error: numbersError, pending: numbersPending, refresh: refreshNumbers } = await useAsyncData('playground.jambonzNumbers', () => PlaygroundApi.jambonzNumbers())
const { data: applications, error: appsError } = await useAsyncData('playground.jambonzApplications', () => PlaygroundApi.jambonzApplications())

const appName = (sid: string | null) => applications.value?.find(a => a.applicationSid === sid)?.name ?? null

// ── Provision trial (custom endpoint — untested, takes a REAL number) ──
const provisionForm = reactive({ reference: '', pin: '' })

const provisionSamples = [
  { label: 'Playground test', apply: () => Object.assign(provisionForm, { reference: 'playground-test', pin: '482913' }) },
]

const provisioning = ref(false)
const provisionResult = ref<IJambonzLiveTrial | null>(null)
const provisionError = ref<ApiError | null>(null)

async function provision() {
  provisioning.value = true
  provisionError.value = null
  try {
    provisionResult.value = await PlaygroundApi.jambonzProvision({
      reference: provisionForm.reference.trim(),
      pin: provisionForm.pin.trim() || undefined,
    })
    releasePhone.value = provisionResult.value.phone
  }
  catch (err) {
    provisionError.value = err as ApiError
  }
  finally {
    provisioning.value = false
  }
}

// ── Release ──
const releasePhone = ref('')
const releasing = ref(false)
const releaseResult = ref<string | null>(null)
const releaseError = ref<ApiError | null>(null)

async function release() {
  releasing.value = true
  releaseError.value = null
  releaseResult.value = null
  try {
    const res = await PlaygroundApi.jambonzRelease(releasePhone.value.trim())
    releaseResult.value = res.released
    refreshNumbers()
  }
  catch (err) {
    releaseError.value = err as ApiError
  }
  finally {
    releasing.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-jambonz">
    <template #header>
      <UDashboardNavbar title="Playground — Jambonz (telephony)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <UAlert
          color="warning" variant="subtle" icon="i-lucide-phone-call"
          title="⚠️ This is Konci's PRODUCTION phone infrastructure"
          description="The pool and agent lists below are read-only and verified working. Provision/release are the old prototype's custom endpoints — never exercised before (the old repo always ran in mock mode). A successful provision takes a real number from the pool: test deliberately, then release. If provision 404s, the server-side endpoint was never built (see .claude/TELEPHONY.md)."
        />

        <!-- Pool + agents (read-only) -->
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">Phone number pool</span>
              <UButton icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="ghost" aria-label="Refresh" :loading="numbersPending" @click="refreshNumbers()" />
            </div>
            <UAlert v-if="numbersError" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Number list failed" :description="numbersError.message" />
            <div v-else-if="numbers" class="bg-default rounded-xl shadow-sm divide-y divide-default">
              <div v-if="numbers.length === 0" class="p-3 text-sm text-muted">
                No numbers in the pool.
              </div>
              <div v-for="n in numbers" :key="n.phoneNumberSid" class="p-3 flex items-center gap-2 flex-wrap">
                <span class="font-medium text-sm font-mono">+{{ n.number }}</span>
                <UBadge v-if="appName(n.applicationSid)" color="neutral" variant="outline" size="sm">
                  {{ appName(n.applicationSid) }}
                </UBadge>
                <UBadge v-else color="warning" variant="subtle" size="sm">
                  no application bound
                </UBadge>
              </div>
            </div>
            <RawJson v-if="numbers" :data="numbers" label="Numbers raw JSON" />
          </div>

          <div class="flex flex-col gap-3">
            <span class="font-medium text-sm">Applications (the AI agents)</span>
            <UAlert v-if="appsError" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Application list failed" :description="appsError.message" />
            <div v-else-if="applications" class="bg-default rounded-xl shadow-sm divide-y divide-default max-h-80 overflow-y-auto">
              <div v-for="a in applications" :key="a.applicationSid" class="p-3 text-sm">
                {{ a.name }}
              </div>
            </div>
            <RawJson v-if="applications" :data="applications" label="Applications raw JSON" />
          </div>
        </div>

        <USeparator />

        <!-- Provision -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Provision trial number <span class="text-xs text-muted font-normal">(custom endpoint — untested ❓)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="provisionSamples" />
              <UFormField label="Reference" help="Tracking string — the old flow passed the campaign step id.">
                <UInput v-model="provisionForm.reference" placeholder="playground-test" class="w-full" />
              </UFormField>
              <UFormField label="PIN" help="6 digits; generated automatically if left empty.">
                <UInput v-model="provisionForm.pin" placeholder="482913" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-phone-incoming" color="warning" label="Provision (takes a real number!)" :loading="provisioning" :disabled="!provisionForm.reference.trim()" class="self-start" @click="provision" />
              <p class="text-xs text-dimmed">
                Live call against production telephony — release the number when you're done testing.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="provisionError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="provisionError.message" :description="provisionError.info ?? undefined" />
            <UCard v-if="provisionResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">Provisioned — call it and enter the PIN</span>
                </div>
                <div><span class="text-muted text-xs block">Demo phone</span><span class="font-mono">{{ provisionResult.phone }}</span></div>
                <div><span class="text-muted text-xs block">PIN</span><span class="font-mono">{{ provisionResult.pin }}</span></div>
              </div>
              <RawJson :data="provisionResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- Release -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Release number <span class="text-xs text-muted font-normal">(custom endpoint — untested ❓)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Phone (E.164)" help="Prefilled automatically after a provision.">
                <UInput v-model="releasePhone" placeholder="+15125559876" class="w-full" @keydown.enter="releasePhone.trim() && release()" />
              </UFormField>
              <UButton icon="i-lucide-phone-off" color="neutral" variant="outline" label="Release back to pool" :loading="releasing" :disabled="!releasePhone.trim()" class="self-start" @click="release" />
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="releaseError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="releaseError.message" :description="releaseError.info ?? undefined" />
            <UCard v-if="releaseResult">
              <div class="text-sm flex items-center gap-2">
                <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                Released <span class="font-mono">{{ releaseResult }}</span> back to the pool.
              </div>
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
