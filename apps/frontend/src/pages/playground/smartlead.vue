<script setup lang="ts">
import type { ISmartleadLiveAnalytics, ISmartleadLiveCampaign, ISmartleadLiveCampaignLeads, ISmartleadLivePushResult, ISmartleadLiveStatistics } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

// Campaigns + email accounts — free reads, load on page open.
const { data: campaigns, error: campaignsError, pending: campaignsPending, refresh: refreshCampaigns } = await useAsyncData('playground.smartleadCampaigns', () => PlaygroundApi.smartleadCampaigns())
const { data: emailAccounts, error: accountsError } = await useAsyncData('playground.smartleadEmailAccounts', () => PlaygroundApi.smartleadEmailAccounts())

const statusColor = (status: string) => ({ ACTIVE: 'success', PAUSED: 'warning', DRAFTED: 'neutral', STOPPED: 'error', ARCHIVED: 'neutral' } as const)[status] ?? 'neutral'

// ── Selected campaign → analytics + statistics + leads ──
const selected = ref<ISmartleadLiveCampaign | null>(null)
const analytics = ref<ISmartleadLiveAnalytics | null>(null)
const statistics = ref<ISmartleadLiveStatistics | null>(null)
const campaignLeads = ref<ISmartleadLiveCampaignLeads | null>(null)
const detailLoading = ref(false)
const detailError = ref<ApiError | null>(null)

async function select(campaign: ISmartleadLiveCampaign) {
  selected.value = campaign
  detailLoading.value = true
  detailError.value = null
  analytics.value = null
  statistics.value = null
  campaignLeads.value = null
  try {
    // Three independent reads — surface the first failure, keep whatever loaded.
    const [a, s, l] = await Promise.allSettled([
      PlaygroundApi.smartleadAnalytics(campaign.id),
      PlaygroundApi.smartleadStatistics(campaign.id, { limit: 20 }),
      PlaygroundApi.smartleadCampaignLeads(campaign.id, { limit: 20 }),
    ])
    if (a.status === 'fulfilled')
      analytics.value = a.value
    if (s.status === 'fulfilled')
      statistics.value = s.value
    if (l.status === 'fulfilled')
      campaignLeads.value = l.value
    const firstFail = [a, s, l].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
    if (firstFail)
      detailError.value = firstFail.reason as ApiError
  }
  finally {
    detailLoading.value = false
  }
}

// ── Push a test lead ──
const pushForm = reactive({
  email: '',
  firstName: '',
  lastName: '',
  companyName: '',
  website: '',
  customFields: '{\n  "video_url": "https://example.com/v/demo",\n  "video_thumbnail": "https://example.com/thumb.jpg"\n}',
})

const pushSamples = [
  { label: 'Yourself (safe)', apply: () => Object.assign(pushForm, { email: 'admin@bluegem.gg', firstName: 'Konci', lastName: 'Test', companyName: 'Konci Playground', website: 'https://konci.ai' }) },
]

const pushing = ref(false)
const pushResult = ref<ISmartleadLivePushResult | null>(null)
const pushError = ref<ApiError | null>(null)

async function pushLead() {
  if (!selected.value)
    return
  let customFields: Record<string, string> | undefined
  try {
    customFields = pushForm.customFields.trim() ? JSON.parse(pushForm.customFields) : undefined
  }
  catch {
    pushError.value = new ApiError('Custom fields must be valid JSON')
    return
  }
  pushing.value = true
  pushError.value = null
  pushResult.value = null
  try {
    pushResult.value = await PlaygroundApi.smartleadAddLead(selected.value.id, {
      email: pushForm.email.trim(),
      firstName: pushForm.firstName.trim() || undefined,
      lastName: pushForm.lastName.trim() || undefined,
      companyName: pushForm.companyName.trim() || undefined,
      website: pushForm.website.trim() || undefined,
      customFields,
    })
  }
  catch (err) {
    pushError.value = err as ApiError
  }
  finally {
    pushing.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-smartlead">
    <template #header>
      <UDashboardNavbar title="Playground — Smartlead (cold email sending)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <UAlert
          color="info" variant="subtle" icon="i-lucide-send"
          title="Smartlead will own outbound cold email"
          description="Sequences are authored in the Smartlead UI; this system pushes leads (with custom fields like video_url) into linked campaigns and pulls stats back. Reads on this page are free. Pushing a lead adds a REAL lead to the selected campaign — if that campaign is ACTIVE, Smartlead may start emailing it. Requires SMARTLEAD_API_KEY (API access is on their Pro plan)."
        />

        <!-- Campaigns + email accounts -->
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">Campaigns</span>
              <UButton icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="ghost" aria-label="Refresh" :loading="campaignsPending" @click="refreshCampaigns()" />
            </div>
            <UAlert v-if="campaignsError" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Campaign list failed" :description="campaignsError.message" />
            <div v-else-if="campaigns" class="bg-default rounded-xl shadow-sm divide-y divide-default">
              <div v-if="campaigns.length === 0" class="p-3 text-sm text-muted">
                No campaigns in the Smartlead account yet — create one in the Smartlead UI.
              </div>
              <div
                v-for="c in campaigns" :key="c.id"
                class="p-3 flex items-center gap-2 flex-wrap cursor-pointer hover:bg-elevated/50 transition"
                :class="{ 'bg-elevated/50': selected?.id === c.id }"
                @click="select(c)"
              >
                <span class="font-medium text-sm">{{ c.name }}</span>
                <UBadge :color="statusColor(c.status)" variant="subtle" size="sm">
                  {{ c.status }}
                </UBadge>
                <span class="text-xs text-muted ms-auto font-mono">#{{ c.id }}</span>
              </div>
            </div>
            <RawJson v-if="campaigns" :data="campaigns" label="Campaigns raw JSON" />
          </div>

          <div class="flex flex-col gap-3">
            <span class="font-medium text-sm">Email accounts (sender mailboxes)</span>
            <UAlert v-if="accountsError" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Email account list failed" :description="accountsError.message" />
            <div v-else-if="emailAccounts" class="bg-default rounded-xl shadow-sm divide-y divide-default max-h-80 overflow-y-auto">
              <div v-if="emailAccounts.length === 0" class="p-3 text-sm text-muted">
                No sender mailboxes connected yet.
              </div>
              <div v-for="a in emailAccounts" :key="a.id ?? a.fromEmail ?? ''" class="p-3 flex items-center gap-2 flex-wrap text-sm">
                <span class="font-mono">{{ a.fromEmail }}</span>
                <span v-if="a.fromName" class="text-muted">{{ a.fromName }}</span>
                <UBadge v-if="a.warmupStatus" color="neutral" variant="outline" size="sm">
                  warmup: {{ a.warmupStatus }}
                </UBadge>
                <span v-if="a.dailyLimit" class="text-xs text-muted ms-auto">{{ a.dailyLimit }}/day</span>
              </div>
            </div>
            <RawJson v-if="emailAccounts" :data="emailAccounts" label="Email accounts raw JSON" />
          </div>
        </div>

        <USeparator />

        <!-- Selected campaign detail -->
        <div v-if="!selected" class="text-sm text-muted">
          Select a campaign above to load its analytics, per-lead statistics and leads.
        </div>
        <template v-else>
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ selected.name }}</span>
            <UBadge :color="statusColor(selected.status)" variant="subtle" size="sm">
              {{ selected.status }}
            </UBadge>
            <UButton icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="ghost" aria-label="Reload detail" :loading="detailLoading" @click="select(selected)" />
          </div>

          <UAlert v-if="detailError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="detailError.message" :description="detailError.info ?? undefined" />

          <!-- Analytics -->
          <div v-if="analytics" class="flex flex-col gap-3">
            <span class="font-medium text-sm">Analytics (aggregate)</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <UCard v-for="stat in [
                { label: 'Leads', value: analytics.totalLeads },
                { label: 'Sent', value: analytics.sentCount },
                { label: 'Opened', value: analytics.openCount },
                { label: 'Clicked', value: analytics.clickCount },
                { label: 'Replied', value: analytics.replyCount },
                { label: 'Bounced', value: analytics.bounceCount },
              ]" :key="stat.label"
              >
                <p class="text-xs text-muted">
                  {{ stat.label }}
                </p>
                <p class="text-xl font-semibold">
                  {{ stat.value ?? '—' }}
                </p>
              </UCard>
            </div>
            <RawJson :data="analytics.raw" label="Analytics raw JSON" />
          </div>

          <!-- Per-lead statistics -->
          <div v-if="statistics" class="flex flex-col gap-3">
            <span class="font-medium text-sm">Per-lead statistics <span class="text-xs text-muted font-normal">(first 20 of {{ statistics.total ?? '?' }} — the S5 stats-mirror source)</span></span>
            <div class="bg-default rounded-xl shadow-sm divide-y divide-default max-h-96 overflow-y-auto">
              <div v-if="statistics.stats.length === 0" class="p-3 text-sm text-muted">
                No email events yet.
              </div>
              <div v-for="(s, i) in statistics.stats" :key="i" class="p-3 flex items-center gap-2 flex-wrap text-sm">
                <span class="font-mono">{{ s.leadEmail }}</span>
                <UBadge color="neutral" variant="outline" size="sm">
                  step {{ s.sequenceNumber ?? '?' }}
                </UBadge>
                <span v-if="s.sentTime" class="text-xs text-muted">sent {{ s.sentTime }}</span>
                <UBadge v-if="s.openCount" color="success" variant="subtle" size="sm">
                  {{ s.openCount }} opens
                </UBadge>
                <UBadge v-if="s.clickCount" color="success" variant="subtle" size="sm">
                  {{ s.clickCount }} clicks
                </UBadge>
                <UBadge v-if="s.replyTime" color="primary" variant="subtle" size="sm">
                  replied
                </UBadge>
                <UBadge v-if="s.isBounced" color="error" variant="subtle" size="sm">
                  bounced
                </UBadge>
              </div>
            </div>
            <RawJson :data="statistics.raw" label="Statistics raw JSON" />
          </div>

          <!-- Campaign leads -->
          <div v-if="campaignLeads" class="flex flex-col gap-3">
            <span class="font-medium text-sm">Leads in campaign <span class="text-xs text-muted font-normal">(first 20 of {{ campaignLeads.total ?? '?' }})</span></span>
            <div class="bg-default rounded-xl shadow-sm divide-y divide-default max-h-96 overflow-y-auto">
              <div v-if="campaignLeads.leads.length === 0" class="p-3 text-sm text-muted">
                No leads in this campaign yet.
              </div>
              <div v-for="(l, i) in campaignLeads.leads" :key="i" class="p-3 flex items-center gap-2 flex-wrap text-sm">
                <span class="font-mono">{{ l.email }}</span>
                <span v-if="l.firstName || l.lastName" class="text-muted">{{ [l.firstName, l.lastName].filter(Boolean).join(' ') }}</span>
                <span v-if="l.companyName" class="text-muted">· {{ l.companyName }}</span>
                <UBadge v-if="l.status" color="neutral" variant="outline" size="sm" class="ms-auto">
                  {{ l.status }}
                </UBadge>
              </div>
            </div>
            <RawJson :data="campaignLeads.raw" label="Campaign leads raw JSON" />
          </div>

          <USeparator />

          <!-- Push test lead -->
          <div class="grid lg:grid-cols-2 gap-6">
            <UCard>
              <template #header>
                <span class="font-medium">Push a test lead to “{{ selected.name }}”</span>
              </template>
              <div class="flex flex-col gap-3">
                <SampleChips :samples="pushSamples" />
                <UFormField label="Email" required>
                  <UInput v-model="pushForm.email" placeholder="you@example.com" class="w-full" />
                </UFormField>
                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="First name">
                    <UInput v-model="pushForm.firstName" class="w-full" />
                  </UFormField>
                  <UFormField label="Last name">
                    <UInput v-model="pushForm.lastName" class="w-full" />
                  </UFormField>
                </div>
                <UFormField label="Company">
                  <UInput v-model="pushForm.companyName" class="w-full" />
                </UFormField>
                <UFormField label="Website">
                  <UInput v-model="pushForm.website" class="w-full" />
                </UFormField>
                <UFormField label="Custom fields (JSON)" help="These become merge variables in Smartlead templates — exactly how video_url / video_thumbnail will flow in the real sync.">
                  <UTextarea v-model="pushForm.customFields" :rows="5" class="w-full font-mono" />
                </UFormField>
                <UButton
                  icon="i-lucide-upload" :color="selected.status === 'ACTIVE' ? 'warning' : 'primary'"
                  :label="selected.status === 'ACTIVE' ? 'Push (campaign is ACTIVE — it may email this lead!)' : 'Push lead'"
                  :loading="pushing" :disabled="!pushForm.email.trim()" class="self-start" @click="pushLead"
                />
              </div>
            </UCard>

            <div class="flex flex-col gap-3">
              <UAlert v-if="pushError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="pushError.message" :description="pushError.info ?? undefined" />
              <UCard v-if="pushResult">
                <div class="flex flex-col gap-2 text-sm">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
                    <span class="font-medium">Push accepted</span>
                  </div>
                  <div>Added: <b>{{ pushResult.addedCount ?? '—' }}</b> · Skipped: <b>{{ pushResult.skippedCount ?? '—' }}</b> <span class="text-muted">(Smartlead dedups by email)</span></div>
                </div>
                <RawJson :data="pushResult.raw" class="mt-3" />
              </UCard>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
