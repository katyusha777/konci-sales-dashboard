<script setup lang="ts">
import { AvatarsApi } from '~/app/api/avatars.api'

const toast = useToast()
const { data: avatars, refresh } = await useAsyncData('avatars.list', () => AvatarsApi.list())

const syncing = ref(false)
async function sync() {
  syncing.value = true
  try {
    await AvatarsApi.sync()
    await refresh()
    toast.add({ title: 'Avatars synced from HeyGen', color: 'success' })
  }
  finally {
    syncing.value = false
  }
}

async function toggleActive(id: string, isActive: boolean) {
  await AvatarsApi.setActive(id, isActive)
  await refresh()
}
</script>

<template>
  <UDashboardPanel id="avatars">
    <template #header>
      <UDashboardNavbar title="Avatars">
        <template #right>
          <UButton icon="i-lucide-refresh-cw" :loading="syncing" color="neutral" variant="outline" label="Sync from HeyGen" @click="sync" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <UCard v-for="a in avatars" :key="a.id" :ui="{ body: 'p-0 sm:p-0' }">
          <img :src="a.previewImageUrl ?? ''" :alt="a.name" class="w-full aspect-square object-cover rounded-t-lg" :class="{ 'opacity-40 grayscale': !a.isActive }">
          <div class="p-3 flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ a.name }}</span>
              <USwitch :model-value="a.isActive" size="sm" @update:model-value="toggleActive(a.id, $event)" />
            </div>
            <div class="text-xs text-muted">
              {{ a.heygenAvatarId }}
            </div>
            <div class="text-xs text-dimmed">
              voice: {{ a.voiceId ?? 'not set' }} · synced {{ formatDate(a.lastSyncedAt) }}
            </div>
          </div>
        </UCard>
      </div>
      <p class="text-sm text-muted mt-4">
        Avatars are created and trained in HeyGen Studio — this list only syncs and activates them for templates.
      </p>
    </template>
  </UDashboardPanel>
</template>
