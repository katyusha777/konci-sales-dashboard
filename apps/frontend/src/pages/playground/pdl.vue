<script setup lang="ts">
import type { IPdlLiveCompany, IPdlLiveCompanyInput, IPdlLivePerson, IPdlLivePersonInput, IPdlLiveSearchPeople, IPdlLiveSearchPeopleInput } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// ── Company enrich ──
const companyInput = reactive<IPdlLiveCompanyInput>({ name: '', website: '', city: '', state: '' })
const companyLoading = ref(false)
const companySearched = ref(false)
const companyResult = ref<IPdlLiveCompany | null>(null)
const companyError = ref<ApiError | null>(null)

async function enrichCompany() {
  companyLoading.value = true
  companyError.value = null
  try {
    const cleaned = Object.fromEntries(Object.entries(toRaw(companyInput)).filter(([, v]) => v && v.trim()))
    companyResult.value = await PlaygroundApi.pdlCompany(cleaned as IPdlLiveCompanyInput)
    companySearched.value = true
  }
  catch (err) {
    companyError.value = err as ApiError
  }
  finally {
    companyLoading.value = false
  }
}

// ── People search at a company ──
const searchInput = reactive<IPdlLiveSearchPeopleInput>({ company: '', city: '', state: '', companyDomain: '', companyLinkedinUrl: '', limit: 10 })
const searchLoading = ref(false)
const searchSearched = ref(false)
const searchResult = ref<IPdlLiveSearchPeople | null>(null)
const searchError = ref<ApiError | null>(null)

async function searchPeople() {
  searchLoading.value = true
  searchError.value = null
  try {
    const raw = toRaw(searchInput)
    const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' || (typeof v === 'string' && v.trim())))
    searchResult.value = await PlaygroundApi.pdlSearchPeople(cleaned as IPdlLiveSearchPeopleInput)
    searchSearched.value = true
  }
  catch (err) {
    searchError.value = err as ApiError
  }
  finally {
    searchLoading.value = false
  }
}

// ── Person enrich / reverse email ──
const personInput = reactive<IPdlLivePersonInput>({ firstName: '', lastName: '', company: '', domain: '', linkedinUrl: '', email: '' })
const personLoading = ref(false)
const personSearched = ref(false)
const personResult = ref<IPdlLivePerson | null>(null)
const personError = ref<ApiError | null>(null)

const hasPersonInput = computed(() => Object.values(personInput).some(v => v && v.trim()))

async function enrichPerson() {
  personLoading.value = true
  personError.value = null
  try {
    const cleaned = Object.fromEntries(Object.entries(toRaw(personInput)).filter(([, v]) => v && v.trim()))
    personResult.value = await PlaygroundApi.pdlPerson(cleaned as IPdlLivePersonInput)
    personSearched.value = true
  }
  catch (err) {
    personError.value = err as ApiError
  }
  finally {
    personLoading.value = false
  }
}

const emailQuery = ref('')
const emailLoading = ref(false)
const emailSearched = ref(false)
const emailResult = ref<IPdlLivePerson | null>(null)
const emailError = ref<ApiError | null>(null)

async function searchByEmail() {
  emailLoading.value = true
  emailError.value = null
  try {
    emailResult.value = await PlaygroundApi.pdlSearchByEmail(emailQuery.value.trim())
    emailSearched.value = true
  }
  catch (err) {
    emailError.value = err as ApiError
  }
  finally {
    emailLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-pdl">
    <template #header>
      <UDashboardNavbar title="Playground — PDL (People Data Labs)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <!-- Company enrich -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Company enrich <span class="text-xs text-muted font-normal">(name + location, domain optional)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Business name">
                <UInput v-model="companyInput.name" placeholder="Lonestar Dental Care" class="w-full" @keydown.enter="enrichCompany" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="City">
                  <UInput v-model="companyInput.city" placeholder="Austin" />
                </UFormField>
                <UFormField label="State">
                  <UInput v-model="companyInput.state" placeholder="TX" />
                </UFormField>
              </div>
              <UFormField label="Website" hint="ignored if it's a shared platform domain">
                <UInput v-model="companyInput.website" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-building-2" label="Enrich company" :loading="companyLoading" :disabled="!companyInput.name?.trim()" class="self-start" @click="enrichCompany" />
              <p class="text-xs text-dimmed">
                Live call — a match consumes a PDL credit (~$0.04).
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="companyError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="companyError.message" :description="companyError.info ?? undefined" />
            <UCard v-if="companySearched && !companyResult && !companyError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-5" />
                No company match (or likelihood below 3).
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
                  <UBadge v-if="companyResult.likelihood !== null" color="neutral" variant="subtle" size="sm">
                    likelihood {{ companyResult.likelihood }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Employees / website</span>{{ companyResult.employeeCount ?? '—' }} · {{ companyResult.website ?? '—' }}</div>
                <div><span class="text-muted text-xs block">LinkedIn</span>{{ companyResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="companyResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- People search -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">People at a company <span class="text-xs text-muted font-normal">(Tier 1: owners/C-suite → Tier 2: anyone)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Company name">
                <UInput v-model="searchInput.company" placeholder="Lonestar Dental Care" class="w-full" @keydown.enter="searchPeople" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="City">
                  <UInput v-model="searchInput.city" placeholder="Austin" />
                </UFormField>
                <UFormField label="State">
                  <UInput v-model="searchInput.state" placeholder="TX" />
                </UFormField>
              </div>
              <UFormField label="Company domain" hint="better match than name">
                <UInput v-model="searchInput.companyDomain" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <UFormField label="Company LinkedIn URL" hint="best match of all">
                <UInput v-model="searchInput.companyLinkedinUrl" placeholder="linkedin.com/company/…" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-users-round" label="Search people" :loading="searchLoading" :disabled="!searchInput.company?.trim() && !searchInput.companyDomain?.trim() && !searchInput.companyLinkedinUrl?.trim()" class="self-start" @click="searchPeople" />
              <p class="text-xs text-dimmed">
                Live call — each search API call costs ~$0.04 (Tier 2 fallback = a second call).
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="searchError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="searchError.message" :description="searchError.info ?? undefined" />
            <template v-if="searchResult">
              <div class="text-sm text-muted flex items-center gap-2">
                {{ searchResult.results.length }} found
                <UBadge :color="searchResult.tier === 'executives' ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ searchResult.tier === 'executives' ? 'Tier 1 — executives' : 'Tier 2 — any employee' }}
                </UBadge>
              </div>
              <UCard v-if="searchResult.results.length === 0">
                <div class="text-sm text-muted flex items-center gap-2">
                  <UIcon name="i-lucide-user-x" class="size-5" />
                  Nobody found at that company.
                </div>
              </UCard>
              <div v-else class="border border-default rounded-lg divide-y divide-default">
                <div v-for="(p, i) in searchResult.results" :key="i" class="p-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ [p.firstName, p.lastName].filter(Boolean).join(' ') || '(no name)' }}</span>
                    <UBadge v-if="p.jobTitle" color="neutral" variant="outline" size="sm">
                      {{ p.jobTitle }}
                    </UBadge>
                    <span class="text-xs text-muted ms-auto">confidence {{ p.confidence }}/10</span>
                  </div>
                  <div class="text-xs text-muted mt-1">
                    {{ p.workEmail ?? 'no email' }} · {{ p.phones.length ? p.phones.join(', ') : 'no phone' }} · {{ p.linkedinUrl ?? 'no LinkedIn' }}
                  </div>
                </div>
              </div>
              <RawJson :data="searchResult" />
            </template>
            <div v-else-if="!searchSearched && !searchError" class="text-sm text-muted py-12 text-center border border-dashed border-default rounded-lg">
              The core contact-discovery call of the enrichment flow.
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Person enrich -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Person enrich <span class="text-xs text-muted font-normal">(any mix of name / email / LinkedIn)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="First name">
                  <UInput v-model="personInput.firstName" placeholder="Sarah" />
                </UFormField>
                <UFormField label="Last name">
                  <UInput v-model="personInput.lastName" placeholder="Mitchell" />
                </UFormField>
              </div>
              <UFormField label="Company name">
                <UInput v-model="personInput.company" placeholder="Lonestar Dental Care" class="w-full" />
              </UFormField>
              <UFormField label="Company domain">
                <UInput v-model="personInput.domain" placeholder="lonestardental.com" class="w-full" />
              </UFormField>
              <UFormField label="LinkedIn URL" hint="most accurate signal">
                <UInput v-model="personInput.linkedinUrl" placeholder="https://linkedin.com/in/…" class="w-full" />
              </UFormField>
              <UFormField label="Email">
                <UInput v-model="personInput.email" placeholder="sarah@…" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-user-search" label="Enrich person" :loading="personLoading" :disabled="!hasPersonInput" class="self-start" @click="enrichPerson" />
              <p class="text-xs text-dimmed">
                Live call — a match consumes a PDL credit (~$0.04).
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="personError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="personError.message" :description="personError.info ?? undefined" />
            <UCard v-if="personSearched && !personResult && !personError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-user-x" class="size-5" />
                No match (or likelihood below 4).
              </div>
            </UCard>
            <UCard v-if="personResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ [personResult.firstName, personResult.lastName].filter(Boolean).join(' ') || 'Match found' }}</span>
                  <UBadge :color="personResult.confidence >= 7 ? 'success' : 'warning'" variant="subtle" size="sm">
                    confidence {{ personResult.confidence }}/10
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Work email</span>{{ personResult.workEmail ?? '—' }}</div>
                <div><span class="text-muted text-xs block">Title</span>{{ personResult.jobTitle ?? '—' }} · {{ personResult.seniority ?? '—' }}</div>
                <div><span class="text-muted text-xs block">Phones</span>{{ personResult.phones.length ? personResult.phones.join(', ') : '—' }}</div>
                <div><span class="text-muted text-xs block">LinkedIn</span>{{ personResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="personResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>

        <USeparator />

        <!-- Reverse email -->
        <div class="grid lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <span class="font-medium">Reverse email lookup <span class="text-xs text-muted font-normal">(who owns this email?)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <UFormField label="Email">
                <UInput v-model="emailQuery" placeholder="sarah@lonestardental.com" class="w-full" @keydown.enter="searchByEmail" />
              </UFormField>
              <UButton icon="i-lucide-at-sign" label="Look up" :loading="emailLoading" :disabled="!emailQuery.trim()" class="self-start" @click="searchByEmail" />
              <p class="text-xs text-dimmed">
                Tries work_email first, then personal_emails (up to two search calls).
              </p>
            </div>
          </UCard>

          <div class="flex flex-col gap-3">
            <UAlert v-if="emailError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="emailError.message" :description="emailError.info ?? undefined" />
            <UCard v-if="emailSearched && !emailResult && !emailError">
              <div class="text-sm text-muted flex items-center gap-2">
                <UIcon name="i-lucide-user-x" class="size-5" />
                No person found for that email.
              </div>
            </UCard>
            <UCard v-if="emailResult">
              <div class="flex flex-col gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                  <span class="font-medium">{{ [emailResult.firstName, emailResult.lastName].filter(Boolean).join(' ') || 'Match found' }}</span>
                  <UBadge color="neutral" variant="outline" size="sm">
                    {{ emailResult.jobTitle ?? 'no title' }}
                  </UBadge>
                </div>
                <div><span class="text-muted text-xs block">Work email / LinkedIn</span>{{ emailResult.workEmail ?? '—' }} · {{ emailResult.linkedinUrl ?? '—' }}</div>
              </div>
              <RawJson :data="emailResult.raw" class="mt-3" />
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
