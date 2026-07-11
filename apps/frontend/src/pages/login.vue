<script setup lang="ts">
definePageMeta({ layout: 'public' })

const route = useRoute()
const error = computed(() => route.query.error as string | undefined)
</script>

<template>
  <UCard class="w-full max-w-sm">
    <div class="flex flex-col items-center gap-6 py-4">
      <div class="flex items-center gap-2 text-xl font-bold">
        <UIcon name="i-lucide-phone-call" class="size-6 text-primary" />
        Konci Sales
      </div>
      <p class="text-sm text-muted text-center">
        Internal sales dashboard. Sign in with your UniFi Identity account.
      </p>
      <UAlert
        v-if="error"
        color="error" variant="subtle" icon="i-lucide-triangle-alert"
        :title="error === 'oidc' ? 'Sign-in failed — try again or check with the team.' : error"
      />
      <UButton to="/api/auth/login" external size="lg" icon="i-lucide-key-round" block>
        Sign in with UniFi
      </UButton>
    </div>
  </UCard>
</template>
