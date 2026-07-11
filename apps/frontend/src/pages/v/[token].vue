<script setup lang="ts">
definePageMeta({ layout: 'public' })

// Dummy-phase public video landing page: any token shows the sample lead.
const playing = ref(false)
const demo = { businessName: 'Lonestar Dental Care', phone: '+1 (512) 555-9876', pin: '4821' }
</script>

<template>
  <div class="w-full max-w-xl flex flex-col gap-6">
    <div class="flex items-center gap-2 justify-center text-lg font-bold">
      <UIcon name="i-lucide-phone-call" class="size-5 text-primary" />
      Konci
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Video player (dummy) -->
      <div class="aspect-video bg-zinc-900 rounded-t-lg flex items-center justify-center relative">
        <template v-if="!playing">
          <UButton icon="i-lucide-play" size="xl" class="rounded-full" aria-label="Play" @click="playing = true" />
        </template>
        <p v-else class="text-white/70 text-sm px-8 text-center">
          ▶ Playing the personalized video for {{ demo.businessName }}… (real player streams from R2 with play/progress tracking)
        </p>
      </div>

      <div class="p-6 flex flex-col gap-4 text-center">
        <h1 class="text-xl font-semibold">
          {{ demo.businessName }}, meet your AI receptionist
        </h1>
        <p class="text-sm text-muted">
          We already set it up. Call your demo line and talk to it right now:
        </p>
        <div class="flex items-center justify-center gap-4">
          <div class="border border-default rounded-lg px-4 py-2">
            <div class="text-xs text-muted">
              Call
            </div>
            <div class="font-semibold">
              {{ demo.phone }}
            </div>
          </div>
          <div class="border border-default rounded-lg px-4 py-2">
            <div class="text-xs text-muted">
              PIN
            </div>
            <div class="font-semibold tracking-widest">
              {{ demo.pin }}
            </div>
          </div>
        </div>
        <UButton size="lg" label="Get this for your business" trailing-icon="i-lucide-arrow-right" class="self-center" />
      </div>
    </UCard>
  </div>
</template>
