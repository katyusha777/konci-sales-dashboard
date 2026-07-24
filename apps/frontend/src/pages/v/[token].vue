<script setup lang="ts">
import { VideosApi } from '~/app/api/video.api'

definePageMeta({ layout: 'public' })

const route = useRoute()
const token = route.params.token as string

const { data: page } = await useAsyncData(`video.${token}`, () => VideosApi.page(token).catch(() => null))

const videoEl = ref<HTMLVideoElement | null>(null)
const streamUrl = computed(() => page.value?.videoSrc ?? VideosApi.streamUrl(token))

// Fire each engagement event once. PROGRESS_25/50/75 as the viewer crosses each quartile.
const fired = new Set<string>()
function fire(type: string, positionSeconds?: number) {
  if (fired.has(type))
    return
  fired.add(type)
  VideosApi.event(token, type, positionSeconds).catch(() => {})
}

onMounted(() => {
  if (page.value)
    fire('PAGE_VIEW')
})

function onTimeUpdate() {
  const el = videoEl.value
  if (!el || !el.duration)
    return
  const pct = (el.currentTime / el.duration) * 100
  const pos = Math.round(el.currentTime)
  if (pct >= 25)
    fire('PROGRESS_25', pos)
  if (pct >= 50)
    fire('PROGRESS_50', pos)
  if (pct >= 75)
    fire('PROGRESS_75', pos)
}
</script>

<template>
  <div class="w-full max-w-xl flex flex-col gap-6">
    <div class="flex items-center gap-2 justify-center text-lg font-bold">
      <UIcon name="i-lucide-phone-call" class="size-5 text-primary" />
      Konci
    </div>

    <UCard v-if="page" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="aspect-video bg-zinc-900 rounded-t-lg overflow-hidden flex items-center justify-center">
        <video
          v-if="page.ready"
          ref="videoEl"
          :src="streamUrl"
          controls
          playsinline
          class="w-full h-full"
          @play="fire('PLAY')"
          @pause="fire('PAUSE')"
          @timeupdate="onTimeUpdate"
          @ended="fire('COMPLETED')"
        />
        <p v-else class="text-white/70 text-sm px-8 text-center">
          Your personalized video is still rendering — check back in a minute.
        </p>
      </div>

      <div class="p-6 flex flex-col gap-4 text-center">
        <h1 class="text-xl font-semibold">
          {{ page.businessName }}, meet your AI receptionist
        </h1>
        <p class="text-sm text-muted">
          We already set it up. Call your demo line and talk to it right now:
        </p>
        <div v-if="page.demoPhone" class="flex items-center justify-center gap-4">
          <div class="border border-default rounded-lg px-4 py-2">
            <div class="text-xs text-muted">
              Call
            </div>
            <div class="font-semibold">
              {{ formatPhoneNational(page.demoPhone) }}
            </div>
          </div>
          <div v-if="page.demoPin" class="border border-default rounded-lg px-4 py-2">
            <div class="text-xs text-muted">
              PIN
            </div>
            <div class="font-semibold tracking-widest">
              {{ page.demoPin }}
            </div>
          </div>
        </div>
        <UButton
          size="lg" label="Get this for your business" trailing-icon="i-lucide-arrow-right" class="self-center"
          :to="page.claimUrl ?? 'https://konci.ai'" target="_blank"
        />
      </div>
    </UCard>

    <UCard v-else>
      <div class="p-6 text-center text-muted">
        <UIcon name="i-lucide-video-off" class="size-8 mx-auto mb-2" />
        <p class="text-sm">
          This video link is not valid or has expired.
        </p>
      </div>
    </UCard>
  </div>
</template>
