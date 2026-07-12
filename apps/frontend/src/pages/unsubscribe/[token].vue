<script setup lang="ts">
import { $api } from '~/app/api/client'

definePageMeta({ layout: 'public' })

const route = useRoute()
const token = route.params.token as string
const done = ref(false)

onMounted(async () => {
  await $api(`/api/unsubscribe/${token}`, { method: 'POST' }).catch(() => {})
  done.value = true
})
</script>

<template>
  <div class="w-full max-w-md flex flex-col gap-6">
    <div class="flex items-center gap-2 justify-center text-lg font-bold">
      <UIcon name="i-lucide-phone-call" class="size-5 text-primary" />
      Konci
    </div>
    <UCard>
      <div class="p-6 text-center flex flex-col gap-3">
        <UIcon :name="done ? 'i-lucide-circle-check' : 'i-lucide-loader-circle'" :class="done ? 'text-success' : 'animate-spin text-muted'" class="size-8 mx-auto" />
        <h1 class="text-lg font-semibold">
          {{ done ? "You've been unsubscribed" : 'Unsubscribing…' }}
        </h1>
        <p v-if="done" class="text-sm text-muted">
          You won't receive any more emails from us. Sorry to see you go.
        </p>
      </div>
    </UCard>
  </div>
</template>
