<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ILead, ILeadListMember } from '~/app/types'
import type { ApiError } from '~/app/api/client'
import { LeadsApi } from '~/app/api/leads.api'
import { ListsApi } from '~/app/api/lists.api'
import { SchedulerApi } from '~/app/api/scheduler.api'

const route = useRoute()
const toast = useToast()
const listId = route.params.id as string

const page = ref(1)
const perPage = ref(25)

const { data: list, refresh: refreshList } = await useAsyncData(`lists.${listId}`, () => ListsApi.get(listId))
const { data: members, status: membersStatus, refresh: refreshMembers } = await useAsyncData(
  `lists.${listId}.members`,
  () => ListsApi.members(listId, page.value, perPage.value),
  { watch: [page, perPage] },
)

const columns: Array<TableColumn<ILeadListMember>> = [
  { accessorKey: 'lead', header: 'Business' },
  { accessorKey: 'score', header: 'Score' },
  { accessorKey: 'leadStatus', header: 'Lead status' },
  { accessorKey: 'konci', header: 'Konci account' },
  { accessorKey: 'demo', header: 'Demo' },
  { accessorKey: 'syncStatus', header: 'Sync' },
  { id: 'actions' },
]

// --- Link to Smartlead campaign + activation -------------------------------------
const { data: slCampaigns } = await useAsyncData('lists.slCampaigns', () => ListsApi.smartleadCampaigns().catch(() => []))
const campaignOptions = computed(() => (slCampaigns.value ?? []).map(c => ({ label: `${c.name} (${c.status})`, value: String(c.id) })))
const linkChoice = ref<string | undefined>()
watch(list, l => linkChoice.value = l?.externalCampaignId ?? undefined, { immediate: true })

const statusBusy = ref(false)
async function saveLink() {
  statusBusy.value = true
  try {
    await ListsApi.update(listId, { externalCampaignId: linkChoice.value ?? null })
    await refreshList()
    toast.add({ title: linkChoice.value ? 'Linked to Smartlead campaign' : 'Unlinked', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not link', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    statusBusy.value = false
  }
}

async function setStatus(status: 'DRAFT' | 'ACTIVE' | 'PAUSED') {
  statusBusy.value = true
  try {
    await ListsApi.update(listId, { status })
    await refreshList()
    toast.add({
      title: status === 'ACTIVE' ? 'List activated — sending begins' : `List ${status.toLowerCase()}`,
      description: status === 'ACTIVE' ? 'The scheduler pushes eligible leads (Konci account ready + email) to Smartlead every 5 minutes.' : undefined,
      color: status === 'ACTIVE' ? 'success' : 'info',
    })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Could not change status', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    statusBusy.value = false
  }
}

// Run the scheduler now (register/poll/sync without waiting 5 min), then refresh.
const syncingNow = ref(false)
async function runSyncNow() {
  syncingNow.value = true
  try {
    const summary = await SchedulerApi.run()
    await Promise.all([refreshList(), refreshMembers()])
    toast.add({
      title: 'Scheduler ran',
      description: `${summary.leadsEnriched} enriched · ${summary.konciRegistered} Konci registered · ${summary.konciPrepared} prepared · ${summary.leadsSynced} pushed · ${summary.leadsWaiting} waiting`,
      color: 'success',
    })
  }
  catch (err) {
    toast.add({ title: 'Scheduler run failed', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    syncingNow.value = false
  }
}

// --- Rename / edit -------------------------------------------------------------
const editModalOpen = ref(false)
const saving = ref(false)
const editForm = reactive({ name: '', description: '' })

function openEdit() {
  editForm.name = list.value?.name ?? ''
  editForm.description = list.value?.description ?? ''
  editModalOpen.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    await ListsApi.update(listId, { name: editForm.name, description: editForm.description || null })
    editModalOpen.value = false
    await refreshList()
    toast.add({ title: 'List updated', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not update list', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// --- Delete --------------------------------------------------------------------
const deleteModalOpen = ref(false)
const deleting = ref(false)

async function deleteList() {
  deleting.value = true
  try {
    await ListsApi.remove(listId)
    toast.add({ title: `List “${list.value?.name}” deleted`, description: 'The leads themselves are untouched.', color: 'success' })
    navigateTo('/lists')
  }
  catch (err) {
    toast.add({ title: 'Could not delete list', description: (err as ApiError).message, color: 'error' })
    deleting.value = false
  }
}

// --- Add leads (search → select across re-filters → confirm) ---------------------
const addLeadsOpen = ref(false)
const addStep = ref<'pick' | 'confirm'>('pick')
const leadSearch = reactive({ search: '', industry: undefined as string | undefined, minScore: undefined as number | undefined })
const searchResults = ref<Array<ILead> | null>(null)
const searchingLeads = ref(false)
// Selection persists across re-filters — keyed by id, keeps the lead for the confirm list.
const pickedLeads = ref<Map<string, ILead>>(new Map())
const addingLeads = ref(false)

const { data: industries } = await useAsyncData('leads.industries', () => LeadsApi.industries())

let searchTimer: ReturnType<typeof setTimeout> | undefined
async function searchLeads() {
  searchingLeads.value = true
  try {
    const result = await LeadsApi.list({ ...leadSearch, search: leadSearch.search || undefined, perPage: 50 })
    searchResults.value = result.items
  }
  finally {
    searchingLeads.value = false
  }
}
watch(leadSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(searchLeads, 300)
})
watch(addLeadsOpen, (open) => {
  if (open) {
    addStep.value = 'pick'
    pickedLeads.value = new Map()
    Object.assign(leadSearch, { search: '', industry: undefined, minScore: undefined })
    // The assign above may schedule a debounced search — cancel it, we fetch now.
    clearTimeout(searchTimer)
    searchLeads()
  }
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function togglePickedLead(lead: ILead) {
  const next = new Map(pickedLeads.value)
  next.has(lead.id) ? next.delete(lead.id) : next.set(lead.id, lead)
  pickedLeads.value = next
}

async function confirmAddLeads() {
  addingLeads.value = true
  try {
    const result = await ListsApi.addLeads(listId, [...pickedLeads.value.keys()])
    addLeadsOpen.value = false
    await Promise.all([refreshMembers(), refreshList()])
    toast.add({
      title: `${result.added} leads added`,
      description: result.duplicates ? `${result.duplicates} were already in the list.` : undefined,
      color: 'success',
    })
  }
  catch (err) {
    toast.add({ title: 'Could not add leads', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    addingLeads.value = false
  }
}

// --- Force resync (one member / whole list) --------------------------------------
// Synced leads get their Smartlead custom fields updated in place (video/demo/claim);
// unsynced ones re-enter the add flow (pushed only while the list is ACTIVE).
const resyncingId = ref<string | null>(null) // member id, or '__all__'
const RESYNC_ALL = '__all__'

async function resync(member?: ILeadListMember) {
  resyncingId.value = member?.id ?? RESYNC_ALL
  try {
    const s = await ListsApi.resync(listId, member?.id)
    await Promise.all([refreshMembers(), refreshList()])
    toast.add({
      title: member
        ? `${member.lead.name}: ${s.updated ? 'Smartlead fields updated' : s.added ? 'pushed to Smartlead' : s.waiting ? 'waiting (see sync column)' : 'failed'}`
        : `Resync: ${s.updated} updated · ${s.added} added · ${s.waiting} waiting · ${s.failed} failed`,
      color: s.failed ? 'warning' : 'success',
    })
  }
  catch (err) {
    const e = err as ApiError
    toast.add({ title: e.message || 'Resync failed', description: e.info ?? undefined, color: 'error' })
  }
  finally {
    resyncingId.value = null
  }
}

// --- Remove member -------------------------------------------------------------
async function removeMember(member: ILeadListMember) {
  try {
    await ListsApi.removeMember(listId, member.id)
    await Promise.all([refreshMembers(), refreshList()])
    toast.add({ title: `${member.lead.name} removed from list`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not remove lead', description: (err as ApiError).message, color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="list-detail">
    <template #header>
      <UDashboardNavbar :title="list?.name ?? 'List'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/lists" aria-label="Back to lists" />
        </template>
        <template #right>
          <StatusBadge v-if="list" :status="list.status" />
          <UButton icon="i-lucide-user-plus" label="Add leads" @click="addLeadsOpen = true" />
          <UButton
            v-if="list?.status !== 'ACTIVE'"
            icon="i-lucide-play" label="Activate" :loading="statusBusy"
            :disabled="!list?.externalCampaignId"
            @click="setStatus('ACTIVE')"
          />
          <UButton v-else icon="i-lucide-pause" color="neutral" variant="outline" label="Pause" :loading="statusBusy" @click="setStatus('PAUSED')" />
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" label="Sync now" :loading="syncingNow" @click="runSyncNow" />
          <UDropdownMenu
            :items="[
              { label: 'Force resync all', icon: 'i-lucide-rotate-cw', onSelect: () => resync() },
              { label: 'Edit list', icon: 'i-lucide-pencil', onSelect: openEdit },
              { label: 'Delete list', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteModalOpen = true },
            ]"
          >
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="More actions" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 flex-wrap">
          <p v-if="list?.description" class="text-sm text-muted">
            {{ list.description }}
          </p>
          <div class="flex items-center gap-2">
            <USelectMenu v-model="linkChoice" value-key="value" :items="campaignOptions" placeholder="Link Smartlead campaign…" class="w-72" />
            <UButton
              v-if="linkChoice !== (list?.externalCampaignId ?? undefined)"
              size="sm" label="Save link" :loading="statusBusy" @click="saveLink"
            />
          </div>
          <span class="text-sm text-muted ms-auto">
            {{ list?.memberCount ?? 0 }} leads · {{ list?.konciReadyCount ?? 0 }} Konci ready · {{ list?.syncedCount ?? 0 }} synced
          </span>
        </div>

        <UAlert
          v-if="list?.status === 'DRAFT'"
          color="info" variant="subtle" icon="i-lucide-shield-check"
          title="Draft — nothing sends yet"
          description="Members get their Konci test accounts registered automatically in the background. Make videos, check the claim links, then link a Smartlead campaign and Activate — only then are leads pushed (and only those with a PREPARED Konci account + an email)."
        />

        <UTable
          :data="members?.items ?? []"
          :columns="columns"
          :loading="membersStatus === 'pending'"
          class="cursor-pointer"
          @select="(_e: Event, row: any) => navigateTo(`/leads/${row.original.lead.id}`)"
        >
          <template #lead-cell="{ row }">
            <div class="font-medium text-highlighted">
              {{ row.original.lead.name }}
            </div>
            <div class="text-xs text-muted">
              {{ row.original.lead.email ?? row.original.lead.domain ?? '—' }}
            </div>
          </template>
          <template #score-cell="{ row }">
            <div class="flex items-center gap-2">
              <UProgress :model-value="row.original.lead.enrichmentScore" size="sm" class="w-14" />
              <span class="text-sm">{{ row.original.lead.enrichmentScore }}</span>
            </div>
          </template>
          <template #leadStatus-cell="{ row }">
            <StatusBadge :status="row.original.lead.status" />
          </template>
          <template #konci-cell="{ row }">
            <div class="flex items-center gap-1.5" @click.stop>
              <StatusBadge v-if="row.original.lead.konciStatus" :status="row.original.lead.konciStatus" />
              <span v-else class="text-xs text-muted">none</span>
              <UTooltip v-if="row.original.lead.konciClaimUrl" text="Open claim link">
                <UButton
                  icon="i-lucide-external-link" size="xs" color="neutral" variant="ghost"
                  :to="row.original.lead.konciClaimUrl" target="_blank" aria-label="Open claim link"
                />
              </UTooltip>
            </div>
          </template>
          <template #demo-cell="{ row }">
            <div class="flex flex-col gap-0.5">
              <div v-if="row.original.lead.demoPhone" class="font-mono text-xs">
                {{ row.original.lead.demoPhone }}
                <span v-if="row.original.lead.demoPin" class="text-muted">· PIN {{ row.original.lead.demoPin }}</span>
              </div>
              <span v-else class="text-xs text-muted">no line</span>
              <a
                v-if="row.original.lead.videoUrl"
                :href="row.original.lead.videoUrl" target="_blank"
                class="text-xs text-primary hover:underline truncate max-w-56 flex items-center gap-1"
                @click.stop
              >
                <UIcon name="i-lucide-video" class="size-3.5 shrink-0 text-success" />
                <span class="truncate">{{ row.original.lead.videoUrl }}</span>
              </a>
              <span v-else class="text-xs text-dimmed flex items-center gap-1">
                <UIcon name="i-lucide-video-off" class="size-3.5" /> no video
              </span>
            </div>
          </template>
          <template #syncStatus-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <StatusBadge :status="row.original.syncStatus" />
              <UTooltip v-if="row.original.syncError" :text="row.original.syncError">
                <UIcon name="i-lucide-triangle-alert" class="size-4 text-error" />
              </UTooltip>
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-0.5" @click.stop>
              <UTooltip text="Re-sync to Smartlead">
                <UButton
                  icon="i-lucide-rotate-cw" size="xs" color="neutral" variant="ghost" aria-label="Re-sync to Smartlead"
                  :loading="resyncingId === row.original.id" :disabled="!!resyncingId"
                  @click="resync(row.original)"
                />
              </UTooltip>
              <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" aria-label="Remove from list" @click="removeMember(row.original)" />
            </div>
          </template>
          <template #empty>
            <div class="p-8 flex flex-col items-center gap-2 text-muted">
              <UIcon name="i-lucide-users" class="size-8" />
              <span class="text-sm">No leads in this list yet — select leads on the Leads page and use “Add to list”.</span>
              <UButton size="xs" color="neutral" variant="outline" label="Go to Leads" to="/leads" />
            </div>
          </template>
        </UTable>

        <div v-if="(members?.total ?? 0) > perPage" class="flex justify-end">
          <UPagination v-model:page="page" :total="members?.total ?? 0" :items-per-page="perPage" />
        </div>
      </div>

      <!-- Add leads: search/filter → select (persists across re-filters) → confirm -->
      <UModal v-model:open="addLeadsOpen" :title="addStep === 'pick' ? 'Add leads to this list' : `Add ${pickedLeads.size} leads?`" :ui="{ content: 'max-w-2xl' }">
        <template #body>
          <div v-if="addStep === 'pick'" class="flex flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              <UInput v-model="leadSearch.search" icon="i-lucide-search" placeholder="Search name, domain, city…" class="flex-1 min-w-48" autofocus />
              <USelectMenu v-model="leadSearch.industry" :items="industries ?? []" placeholder="Industry" class="w-40" />
              <USelect
                v-model="leadSearch.minScore"
                :items="[{ label: 'Any score', value: undefined as any }, { label: '60+', value: 60 }, { label: '80+', value: 80 }]"
                placeholder="Min score"
                class="w-28"
              />
            </div>
            <div class="border border-default rounded-lg divide-y divide-default max-h-80 overflow-y-auto">
              <div v-if="searchingLeads && !searchResults" class="p-6 text-center text-sm text-muted">
                Searching…
              </div>
              <div v-else-if="!searchResults?.length" class="p-6 text-center text-sm text-muted">
                No leads match — adjust the search.
              </div>
              <label
                v-for="l in searchResults" :key="l.id"
                class="flex items-center gap-3 px-3 py-2 hover:bg-elevated/50 cursor-pointer"
              >
                <UCheckbox :model-value="pickedLeads.has(l.id)" @update:model-value="togglePickedLead(l)" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ l.name }}
                  </div>
                  <div class="text-xs text-muted truncate">
                    {{ [l.city, l.state].filter(Boolean).join(', ') || '—' }} · {{ l.industry ?? 'no industry' }} · score {{ l.enrichmentScore }}
                  </div>
                </div>
                <StatusBadge :status="l.status" />
              </label>
            </div>
            <p class="text-sm text-muted">
              {{ pickedLeads.size }} selected — selection survives re-filtering.
            </p>
          </div>

          <div v-else class="flex flex-col gap-2">
            <p class="text-sm text-muted">
              These leads will be added to “{{ list?.name }}”. Already-present leads are skipped.
            </p>
            <div class="border border-default rounded-lg divide-y divide-default max-h-80 overflow-y-auto">
              <div v-for="l in pickedLeads.values()" :key="l.id" class="flex items-center gap-2 px-3 py-2 text-sm">
                <span class="flex-1 truncate font-medium">{{ l.name }}</span>
                <span class="text-xs text-muted">{{ [l.city, l.state].filter(Boolean).join(', ') }}</span>
                <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" aria-label="Remove" @click="togglePickedLead(l)" />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <template v-if="addStep === 'pick'">
            <UButton :label="`Continue with ${pickedLeads.size} leads`" :disabled="!pickedLeads.size" @click="addStep = 'confirm'" />
          </template>
          <template v-else>
            <UButton color="neutral" variant="ghost" label="Back" @click="addStep = 'pick'" />
            <UButton :label="`Add ${pickedLeads.size} leads`" :loading="addingLeads" :disabled="!pickedLeads.size" @click="confirmAddLeads" />
          </template>
        </template>
      </UModal>

      <!-- Edit -->
      <UModal v-model:open="editModalOpen" title="Edit list">
        <template #body>
          <div class="flex flex-col gap-3">
            <UFormField label="Name" required>
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField label="Description" hint="optional">
              <UTextarea v-model="editForm.description" :rows="2" class="w-full" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <UButton label="Save" :loading="saving" :disabled="!editForm.name.trim()" @click="saveEdit" />
        </template>
      </UModal>

      <!-- Delete confirm -->
      <UModal v-model:open="deleteModalOpen" title="Delete list?" :description="`“${list?.name}” and its ${list?.memberCount ?? 0} memberships will be removed. The leads themselves stay.`">
        <template #footer>
          <UButton color="neutral" variant="ghost" label="Cancel" @click="deleteModalOpen = false" />
          <UButton color="error" label="Delete list" :loading="deleting" @click="deleteList" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
