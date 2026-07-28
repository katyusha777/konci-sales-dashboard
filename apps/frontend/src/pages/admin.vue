<script setup lang="ts">
import { ApiError } from '~/app/api/client'
import { AdminApi } from '~/app/api/admin.api'

const toast = useToast()
const { data: counts, refresh } = await useAsyncData('admin.counts', () => AdminApi.counts())

interface DangerAction {
  key: string
  title: string
  description: string
  count: () => number
  run: () => Promise<{ deleted: number }>
}

const ACTIONS: Array<DangerAction> = [
  {
    key: 'leads',
    title: 'Delete ALL leads',
    description: 'Every lead and everything on them: contacts, notes, costs, enrichment history, emails, videos (including the files in R2), Konci registrations, list memberships.',
    count: () => counts.value?.leads ?? 0,
    run: AdminApi.deleteAllLeads,
  },
  {
    key: 'lists',
    title: 'Delete ALL lists',
    description: 'Every list and its memberships. The leads themselves stay. Linked Smartlead campaigns are NOT touched — clean those up in Smartlead.',
    count: () => counts.value?.lists ?? 0,
    run: AdminApi.deleteAllLists,
  },
]

// Type-to-confirm modal
const CONFIRM_WORD = 'DELETE'
const pending = ref<DangerAction | null>(null)
const confirmText = ref('')
const running = ref(false)

function open(action: DangerAction) {
  pending.value = action
  confirmText.value = ''
}

async function execute() {
  if (!pending.value)
    return
  running.value = true
  try {
    const { deleted } = await pending.value.run()
    toast.add({ title: `${deleted} deleted`, description: pending.value.title, color: 'success' })
    pending.value = null
    await refresh()
  }
  catch (err) {
    toast.add({ title: 'Delete failed', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    running.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="admin">
    <template #header>
      <UDashboardNavbar title="Admin" />
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-3xl">
        <!-- Current data -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <UCard v-for="(value, key) in counts ?? {}" :key="key" :ui="{ body: 'p-4 sm:p-4' }">
            <div class="text-2xl font-semibold text-highlighted">
              {{ value.toLocaleString() }}
            </div>
            <div class="text-sm text-muted capitalize">
              {{ key }}
            </div>
          </UCard>
        </div>

        <!-- Danger zone -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-shield-alert" class="text-error size-5" />
              <span class="font-semibold">Danger zone</span>
            </div>
          </template>
          <div class="divide-y divide-default">
            <div v-for="action in ACTIONS" :key="action.key" class="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div class="flex-1">
                <div class="font-medium">
                  {{ action.title }} <span class="text-muted font-normal">({{ action.count().toLocaleString() }})</span>
                </div>
                <div class="text-sm text-muted mt-0.5">
                  {{ action.description }}
                </div>
              </div>
              <UButton color="error" variant="outline" label="Delete" :disabled="!action.count()" @click="open(action)" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Type-to-confirm -->
      <UModal :open="!!pending" :title="pending?.title" description="This cannot be undone." @update:open="pending = null">
        <template #body>
          <div class="flex flex-col gap-3">
            <UAlert color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="`${pending?.count().toLocaleString()} will be permanently deleted`" :description="pending?.description" />
            <UFormField :label="`Type ${CONFIRM_WORD} to confirm`">
              <UInput v-model="confirmText" :placeholder="CONFIRM_WORD" class="w-full" @keyup.enter="confirmText === CONFIRM_WORD && execute()" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <UButton color="neutral" variant="ghost" label="Cancel" @click="pending = null" />
          <UButton color="error" :label="pending?.title" :loading="running" :disabled="confirmText !== CONFIRM_WORD" @click="execute" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
