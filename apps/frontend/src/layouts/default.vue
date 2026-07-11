<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user } = useAuth()
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (dark: boolean) => colorMode.preference = dark ? 'dark' : 'light',
})

const links: Array<NavigationMenuItem> = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Leads', icon: 'i-lucide-users', to: '/leads' },
  { label: 'Campaigns', icon: 'i-lucide-send', to: '/campaigns' },
  { label: 'Templates', icon: 'i-lucide-file-text', to: '/templates' },
  { label: 'Avatars', icon: 'i-lucide-user-round', to: '/avatars' },
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible :min-size="12" :default-size="16" :max-size="24">
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 font-bold">
          <UIcon name="i-lucide-phone-call" class="size-5 text-primary shrink-0" />
          <span v-if="!collapsed">Konci Sales</span>
        </div>
      </template>

      <UNavigationMenu :items="links" orientation="vertical" />

      <template #footer="{ collapsed }">
        <div class="flex flex-col gap-3 w-full">
          <UBadge v-if="!collapsed" color="warning" variant="subtle" icon="i-lucide-flask-conical" class="justify-center w-full">
            Test mode — emails redirected
          </UBadge>
          <UIcon v-else name="i-lucide-flask-conical" class="size-4 text-warning mx-auto" />

          <ClientOnly>
            <div class="flex items-center justify-between" :class="{ 'justify-center': collapsed }">
              <span v-if="!collapsed" class="text-sm text-muted flex items-center gap-1.5">
                <UIcon :name="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" class="size-4" />
                Dark mode
              </span>
              <USwitch v-model="isDark" size="sm" aria-label="Toggle dark mode" />
            </div>
          </ClientOnly>

          <div class="flex items-center gap-2 border border-default rounded-lg p-2" :class="{ 'justify-center border-0 p-0': collapsed }">
            <UAvatar :alt="user?.name ?? user?.email ?? 'K'" icon="i-lucide-user" size="xs" />
            <div v-if="!collapsed" class="min-w-0">
              <p class="text-sm font-medium truncate">
                {{ user?.name ?? 'Konci team' }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ user?.email ?? 'sign-in parked' }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
