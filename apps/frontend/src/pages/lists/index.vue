<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ILeadList } from '~/app/types'
import type { ApiError } from '~/app/api/client'
import { ListsApi } from '~/app/api/lists.api'

const toast = useToast()

const { data: lists, status, refresh } = await useAsyncData('lists.list', () => ListsApi.list())

// Same table design as the Leads page — row click opens the list.
const columns: Array<TableColumn<ILeadList>> = [
  { accessorKey: 'name', header: 'List' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'campaign', header: 'Smartlead campaign' },
  { accessorKey: 'memberCount', header: 'Leads' },
  { accessorKey: 'konciReadyCount', header: 'Konci ready' },
  { accessorKey: 'syncedCount', header: 'Synced' },
  { accessorKey: 'createdAt', header: 'Created' },
]

// --- Create list ---------------------------------------------------------------
const createModalOpen = ref(false)
const creating = ref(false)
const newList = reactive({ name: '', description: '' })

async function createList() {
  creating.value = true
  try {
    const created = await ListsApi.create({ name: newList.name, description: newList.description || undefined })
    createModalOpen.value = false
    Object.assign(newList, { name: '', description: '' })
    await refresh()
    toast.add({ title: `List “${created.name}” created`, description: 'Add leads from the Leads page (bulk select → Add to list).', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not create list', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="lists">
    <template #header>
      <UDashboardNavbar title="Lists">
        <template #right>
          <UButton icon="i-lucide-plus" label="New list" @click="createModalOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          Organize mined leads into lists, then link each list to a Smartlead campaign and
          sync — the campaign does the emailing, stats flow back per lead.
        </p>

        <UTable
          :data="lists ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          class="cursor-pointer"
          @select="(_e: Event, row: any) => navigateTo(`/lists/${row.original.id}`)"
        >
          <template #name-cell="{ row }">
            <div class="font-medium text-highlighted">
              {{ row.original.name }}
            </div>
            <div v-if="row.original.description" class="text-xs text-muted truncate max-w-64">
              {{ row.original.description }}
            </div>
          </template>
          <template #status-cell="{ row }">
            <StatusBadge :status="row.original.status" />
          </template>
          <template #campaign-cell="{ row }">
            <UBadge v-if="row.original.provider" color="neutral" variant="subtle" size="sm">
              #{{ row.original.externalCampaignId }}
            </UBadge>
            <span v-else class="text-xs text-muted">not linked</span>
          </template>
          <template #konciReadyCount-cell="{ row }">
            <span :class="row.original.konciReadyCount < row.original.memberCount ? 'text-warning' : ''">
              {{ row.original.konciReadyCount }}/{{ row.original.memberCount }}
            </span>
          </template>
          <template #createdAt-cell="{ row }">
            {{ formatDate(row.original.createdAt) }}
          </template>
          <template #empty>
            <div class="p-8 flex flex-col items-center gap-2 text-muted">
              <UIcon name="i-lucide-list-plus" class="size-8" />
              <span class="text-sm">No lists yet — create one, then bulk-add leads from the Leads page.</span>
            </div>
          </template>
        </UTable>
      </div>

      <UModal v-model:open="createModalOpen" title="New list" description="A named set of leads to push to a sending campaign.">
        <template #body>
          <div class="flex flex-col gap-3">
            <UFormField label="Name" required>
              <UInput v-model="newList.name" placeholder="Barbershops — Texas, July" class="w-full" @keydown.enter="newList.name.trim() && createList()" />
            </UFormField>
            <UFormField label="Description" hint="optional">
              <UTextarea v-model="newList.description" :rows="2" class="w-full" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <UButton label="Create list" :loading="creating" :disabled="!newList.name.trim()" @click="createList" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
