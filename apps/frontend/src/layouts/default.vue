<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user, logout } = useAuth()
const route = useRoute()
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (dark: boolean) => colorMode.preference = dark ? 'dark' : 'light',
})

const inPlayground = computed(() => route.path.startsWith('/playground'))
const inTools = computed(() => route.path.startsWith('/tools'))

const links = computed<Array<Array<NavigationMenuItem>>>(() => [
  [
    { label: 'Menu', type: 'label' },
    { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
    { label: 'Leads', icon: 'i-lucide-users', to: '/leads' },
    { label: 'Lists', icon: 'i-lucide-list-checks', to: '/lists' },
    { label: 'Templates', icon: 'i-lucide-file-text', to: '/templates' },
    { label: 'Videos', icon: 'i-lucide-clapperboard', to: '/videos' },
    { label: 'Avatars', icon: 'i-lucide-user-round', to: '/avatars' },
    {
      label: 'Tools',
      icon: 'i-lucide-wrench',
      defaultOpen: inTools.value,
      children: [
        { label: 'Email builder', to: '/tools/email-builder' },
      ],
    },
  ],
  [
    { label: 'Developer', type: 'label' },
    {
      label: 'Playground',
      icon: 'i-lucide-flask-conical',
      to: '/playground',
      defaultOpen: inPlayground.value,
      children: [
        // Status emojis = live API test results 2026-07-12 (see /playground cards)
        { label: 'Scrap.io ✅', to: '/playground/scrapio' },
        { label: 'Google Places ✅', to: '/playground/google-places' },
        { label: 'Firecrawl ✅', to: '/playground/firecrawl' },
        { label: 'OpenRouter ✅', to: '/playground/openrouter' },
        { label: 'Apollo ✅', to: '/playground/apollo' },
        { label: 'PDL ✅', to: '/playground/pdl' },
        { label: 'Hunter ✅', to: '/playground/hunter' },
        { label: 'FullEnrich ✅', to: '/playground/fullenrich' },
        { label: 'HeyGen ✅', to: '/playground/heygen' },
        { label: 'Smartlead ⚠️', to: '/playground/smartlead' },
        { label: 'Konci ❓', to: '/playground/konci' },
      ],
    },
    { label: 'Admin', icon: 'i-lucide-shield-alert', to: '/admin' },
  ],
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible :min-size="12" :default-size="16" :max-size="24">
      <template #header="{ collapsed }">
        <NuxtLink to="/" aria-label="Konci dashboard" class="flex items-center py-1.5" :class="{ 'mx-auto': collapsed }">
          <img v-if="!collapsed" src="/konci.webp" alt="Konci" class="h-7 w-auto dark:invert">
          <img v-else src="/konci-mark.png" alt="Konci" class="h-7 w-auto dark:invert">
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :key="`${inPlayground}-${inTools}`"
          :items="links"
          :collapsed="collapsed"
          orientation="vertical"
          color="neutral"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex flex-col gap-3 w-full" :class="{ 'items-center': collapsed }">
          <UBadge v-if="!collapsed" color="warning" variant="soft" size="sm" icon="i-lucide-flask-conical" class="justify-center w-full">
            Test mode — emails redirected
          </UBadge>
          <UIcon v-else name="i-lucide-flask-conical" class="size-4 text-warning" />

          <div
            class="flex items-center gap-2.5 w-full rounded-xl"
            :class="collapsed ? 'justify-center' : 'bg-elevated/60 px-2.5 py-2'"
          >
            <UAvatar :alt="user?.name ?? user?.email ?? 'K'" icon="i-lucide-user" size="sm" />
            <div v-if="!collapsed" class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">
                {{ user?.name ?? 'Konci team' }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ user?.email ?? '' }}
              </p>
            </div>
            <ClientOnly v-if="!collapsed">
              <div class="flex items-center">
                <UButton
                  :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                  @click="isDark = !isDark"
                />
                <UButton
                  icon="i-lucide-log-out"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Log out"
                  @click="logout"
                />
              </div>
            </ClientOnly>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
