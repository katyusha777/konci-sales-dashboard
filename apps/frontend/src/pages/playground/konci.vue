<script setup lang="ts">
import type { IKonciLiveResult } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// ── Register a lead ──
const form = reactive({ businessName: '', website: '', contactName: '', socialMedia: '', teamSize: '' })
const samples = [
  { label: 'Playground test', apply: () => Object.assign(form, { businessName: 'Konci Playground Test', website: 'katyushaicewear.com', contactName: '', socialMedia: '', teamSize: '1-10' }) },
]

const registering = ref(false)
const registerResult = ref<IKonciLiveResult | null>(null)
const registerError = ref<ApiError | null>(null)

async function register() {
  registering.value = true
  registerError.value = null
  try {
    registerResult.value = await PlaygroundApi.konciRegister({
      businessName: form.businessName.trim(),
      website: form.website.trim(),
      contactName: form.contactName.trim() || undefined,
      socialMedia: form.socialMedia.trim() || undefined,
      teamSize: form.teamSize.trim() || undefined,
    })
    lookupId.value = registerResult.value.konciLeadId
  }
  catch (err) {
    registerError.value = err as ApiError
  }
  finally {
    registering.value = false
  }
}

// ── Poll / retry / claim link by konci lead id ──
const lookupId = ref('')
const lookupBusy = ref(false)
const lookupResult = ref<IKonciLiveResult | null>(null)
const lookupError = ref<ApiError | null>(null)

async function runLookup(action: 'get' | 'retry' | 'claim') {
  lookupBusy.value = true
  lookupError.value = null
  try {
    const id = lookupId.value.trim()
    lookupResult.value = action === 'get'
      ? await PlaygroundApi.konciLead(id)
      : action === 'retry'
        ? await PlaygroundApi.konciRetry(id)
        : await PlaygroundApi.konciClaimLink(id)
  }
  catch (err) {
    lookupError.value = err as ApiError
  }
  finally {
    lookupBusy.value = false
  }
}

const statusColor = (s: string) => ({ prepared: 'success', pending: 'info', needs_phone: 'warning', failed: 'error', skipped: 'neutral' } as const)[s] ?? 'neutral'
</script>

<template>
  <UDashboardPanel id="playground-konci">
    <template #header>
      <UDashboardNavbar title="Playground — Konci platform (internal leads API)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <UAlert
          color="info" variant="subtle" icon="i-lucide-rocket"
          title="Registers a REAL test account on Konci staging"
          description="POST /api/internal/leads on app-staging.konci.ai — their pipeline builds the lead a dashboard + claim link (~80s, poll until prepared / needs_phone / failed / skipped). In the real flow the cron does this automatically for every list member; a lead is never pushed to Smartlead without a prepared account."
        />

        <div class="grid lg:grid-cols-2 gap-6">
          <!-- Register -->
          <UCard>
            <template #header>
              <span class="font-medium">Register a lead</span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="samples" />
              <UFormField label="Business name" required>
                <UInput v-model="form.businessName" placeholder="Acme Plumbing" class="w-full" />
              </UFormField>
              <UFormField label="Website" required>
                <UInput v-model="form.website" placeholder="acme.com" class="w-full" />
              </UFormField>
              <UFormField label="Contact name">
                <UInput v-model="form.contactName" class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Social media">
                  <UInput v-model="form.socialMedia" placeholder="https://instagram.com/…" />
                </UFormField>
                <UFormField label="Team size">
                  <UInput v-model="form.teamSize" placeholder="20-50" />
                </UFormField>
              </div>
              <UButton icon="i-lucide-rocket" label="Register (creates staging account)" :loading="registering" :disabled="!form.businessName.trim() || !form.website.trim()" class="self-start" @click="register" />
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="registerError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="registerError.message" :description="registerError.info ?? undefined" />
            <UCard v-if="registerResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UBadge :color="statusColor(registerResult.status)" variant="subtle">
                    {{ registerResult.status }}
                  </UBadge>
                  <span class="font-mono text-xs">{{ registerResult.konciLeadId }}</span>
                </div>
                <div v-if="registerResult.claimUrl">
                  <span class="text-muted text-xs block">Claim URL</span>
                  <a :href="registerResult.claimUrl" target="_blank" class="text-primary text-xs break-all">{{ registerResult.claimUrl }}</a>
                </div>
                <p class="text-xs text-muted">
                  Pipeline runs ~80s — use the lookup below to poll until terminal.
                </p>
              </div>
              <RawJson :data="registerResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- Lookup / retry / claim-link -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Poll / retry / new claim link</span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Konci lead id" help="Prefilled by a register above.">
                <UInput v-model="lookupId" class="w-full font-mono" @keydown.enter="lookupId.trim() && runLookup('get')" />
              </UFormField>
              <div class="flex gap-2 flex-wrap">
                <UButton icon="i-lucide-refresh-cw" label="Get status" :loading="lookupBusy" :disabled="!lookupId.trim()" @click="runLookup('get')" />
                <UButton icon="i-lucide-rotate-ccw" color="warning" variant="outline" label="Retry pipeline" :loading="lookupBusy" :disabled="!lookupId.trim()" @click="runLookup('retry')" />
                <UButton icon="i-lucide-link" color="neutral" variant="outline" label="Mint claim link" :loading="lookupBusy" :disabled="!lookupId.trim()" @click="runLookup('claim')" />
              </div>
              <p class="text-xs text-muted">
                Retry only works for failed / needs_phone / skipped.
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="lookupError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="lookupError.message" :description="lookupError.info ?? undefined" />
            <UCard v-if="lookupResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UBadge :color="statusColor(lookupResult.status)" variant="subtle">
                    {{ lookupResult.status }}
                  </UBadge>
                  <span v-if="lookupResult.claimExpiresAt" class="text-xs text-muted">claim expires {{ lookupResult.claimExpiresAt }}</span>
                </div>
                <a v-if="lookupResult.claimUrl" :href="lookupResult.claimUrl" target="_blank" class="text-primary text-xs break-all">{{ lookupResult.claimUrl }}</a>
              </div>
              <RawJson :data="lookupResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
