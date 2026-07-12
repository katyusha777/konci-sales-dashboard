<script setup lang="ts">
import type { IHeygenLiveAvatar, IHeygenLiveAvatarGroup, IHeygenLiveTemplate, IHeygenLiveVariable, IHeygenLiveVideoStatus, IHeygenLiveVoice } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'

const error = ref<ApiError | null>(null)
function surface(err: unknown) {
  error.value = err as ApiError
}

// ── Avatars ──────────────────────────────────────────────────────────────────
const avatars = ref<Array<IHeygenLiveAvatar> | null>(null)
const includeStock = ref(false)
const loadingAvatars = ref(false)
async function syncAvatars() {
  loadingAvatars.value = true
  error.value = null
  try {
    avatars.value = await PlaygroundApi.heygenAvatars(includeStock.value)
  }
  catch (err) { surface(err) }
  finally { loadingAvatars.value = false }
}

// ── Avatar groups (photo avatars live here, e.g. "Shaun - Startup Founder") ──
const groups = ref<Array<IHeygenLiveAvatarGroup> | null>(null)
const loadingGroups = ref(false)
async function loadGroups() {
  loadingGroups.value = true
  error.value = null
  try {
    groups.value = await PlaygroundApi.heygenAvatarGroups()
  }
  catch (err) { surface(err) }
  finally { loadingGroups.value = false }
}

// ── Voices ───────────────────────────────────────────────────────────────────
const voices = ref<Array<IHeygenLiveVoice> | null>(null)
const loadingVoices = ref(false)
async function loadVoices() {
  loadingVoices.value = true
  error.value = null
  try {
    voices.value = await PlaygroundApi.heygenVoices()
  }
  catch (err) { surface(err) }
  finally { loadingVoices.value = false }
}

// ── Studio templates ─────────────────────────────────────────────────────────
const templates = ref<Array<IHeygenLiveTemplate> | null>(null)
const templateVars = ref<Record<string, IHeygenLiveVariable> | null>(null)
const inspectedTemplateId = ref<string | null>(null)
const loadingTemplates = ref(false)
async function loadTemplates() {
  loadingTemplates.value = true
  error.value = null
  try {
    templates.value = await PlaygroundApi.heygenTemplates()
  }
  catch (err) { surface(err) }
  finally { loadingTemplates.value = false }
}
async function inspectTemplate(id: string) {
  inspectedTemplateId.value = id
  templateVars.value = null
  try {
    templateVars.value = await PlaygroundApi.heygenTemplateVariables(id)
  }
  catch (err) { surface(err) }
}

// ── Video generation ─────────────────────────────────────────────────────────
const gen = reactive({
  avatarId: undefined as string | undefined,
  voiceId: undefined as string | undefined,
  script: 'Hey there! This is a Konci playground test video. If you can hear me, the HeyGen pipeline works end to end.',
})
const generating = ref(false)
const videoId = ref<string | null>(null)
const videoStatus = ref<IHeygenLiveVideoStatus | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null

// Generate can use avatars from BOTH the flat list and avatar groups.
// Group looks are photo avatars → generated as "talking_photo" characters.
const avatarOptions = computed(() => [
  ...(avatars.value ?? []).map(a => ({ label: `${a.name} (${a.type})`, value: a.avatarId, type: a.type })),
  ...(groups.value ?? []).flatMap(g => g.avatars.map(a => ({ label: `${g.name} / ${a.name}`, value: a.avatarId, type: 'talking_photo' as const }))),
])
const characterTypeById = computed(() => Object.fromEntries(avatarOptions.value.map(o => [o.value, o.type])))
const voiceOptions = computed(() => (voices.value ?? []).map(v => ({ label: `${v.name}${v.language ? ` — ${v.language}` : ''}`, value: v.voiceId })))

async function generate() {
  if (!gen.avatarId || !gen.voiceId)
    return
  generating.value = true
  error.value = null
  videoStatus.value = null
  try {
    const res = await PlaygroundApi.heygenGenerate({
      avatarId: gen.avatarId,
      characterType: characterTypeById.value[gen.avatarId],
      voiceId: gen.voiceId,
      script: gen.script,
    })
    videoId.value = res.videoId
    poll()
  }
  catch (err) {
    surface(err)
    generating.value = false
  }
}

async function poll() {
  if (!videoId.value)
    return
  try {
    videoStatus.value = await PlaygroundApi.heygenVideoStatus(videoId.value)
    if (videoStatus.value.status === 'completed' || videoStatus.value.status === 'failed') {
      generating.value = false
      return
    }
  }
  catch (err) {
    surface(err)
    generating.value = false
    return
  }
  pollTimer = setTimeout(poll, 5000)
}

onUnmounted(() => {
  if (pollTimer)
    clearTimeout(pollTimer)
})
</script>

<template>
  <UDashboardPanel id="playground-heygen">
    <template #header>
      <UDashboardNavbar title="Playground — HeyGen">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-4xl">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

        <!-- Avatar groups (photo avatars) -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Avatar groups <span class="text-xs text-muted font-normal">(photo avatars live here)</span></span>
              <UButton size="sm" icon="i-lucide-users-round" label="List groups" :loading="loadingGroups" @click="loadGroups" />
            </div>
          </template>
          <div v-if="groups === null" class="text-sm text-muted py-4 text-center">
            Not loaded yet.
          </div>
          <div v-else-if="!groups.length" class="text-sm text-muted py-4 text-center">
            No avatar groups in this HeyGen account.
          </div>
          <template v-else>
            <div v-for="g in groups" :key="g.groupId" class="mb-3">
              <p class="text-sm font-medium mb-2">
                {{ g.name }} <span class="text-xs text-muted font-normal">({{ g.avatars.length }} looks)</span>
              </p>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div v-for="a in g.avatars" :key="a.avatarId" class="text-center">
                  <img v-if="a.previewImageUrl" :src="a.previewImageUrl" :alt="a.name" class="w-full aspect-square object-cover rounded-lg">
                  <div v-else class="w-full aspect-square rounded-lg bg-elevated flex items-center justify-center">
                    <UIcon name="i-lucide-user" class="size-6 text-dimmed" />
                  </div>
                  <p class="text-xs mt-1 truncate">
                    {{ a.name }}
                  </p>
                </div>
              </div>
            </div>
            <RawJson :data="groups" />
          </template>
        </UCard>

        <!-- Avatars (flat list) -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Video avatars <span class="text-xs text-muted font-normal">(full catalog — takes ~1 min, HeyGen returns everything)</span></span>
              <div class="flex items-center gap-3">
                <UCheckbox v-model="includeStock" label="Include stock avatars" />
                <UButton size="sm" icon="i-lucide-refresh-cw" label="Sync from HeyGen" :loading="loadingAvatars" @click="syncAvatars" />
              </div>
            </div>
          </template>
          <div v-if="avatars === null" class="text-sm text-muted py-4 text-center">
            Not synced yet.
          </div>
          <div v-else-if="!avatars.length" class="text-sm text-muted py-4 text-center">
            No custom avatars in this HeyGen account — tick "include stock" to see HeyGen's built-in ones.
          </div>
          <template v-else>
            <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div v-for="a in avatars.slice(0, 18)" :key="a.avatarId" class="text-center">
                <img v-if="a.previewImageUrl" :src="a.previewImageUrl" :alt="a.name" class="w-full aspect-square object-cover rounded-lg">
                <div v-else class="w-full aspect-square rounded-lg bg-elevated flex items-center justify-center">
                  <UIcon name="i-lucide-user" class="size-6 text-dimmed" />
                </div>
                <p class="text-xs mt-1 truncate">
                  {{ a.name }}
                </p>
              </div>
            </div>
            <p v-if="avatars.length > 18" class="text-xs text-muted mt-2">
              +{{ avatars.length - 18 }} more (see raw JSON)
            </p>
            <RawJson :data="avatars" class="mt-3" />
          </template>
        </UCard>

        <!-- Voices -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Voices</span>
              <UButton size="sm" icon="i-lucide-audio-lines" label="List voices" :loading="loadingVoices" @click="loadVoices" />
            </div>
          </template>
          <div v-if="voices === null" class="text-sm text-muted py-4 text-center">
            Not loaded yet.
          </div>
          <template v-else>
            <p class="text-sm text-muted mb-2">
              {{ voices.length }} voices — first 10 shown.
            </p>
            <div class="divide-y divide-default border border-default rounded-lg">
              <div v-for="v in voices.slice(0, 10)" :key="v.voiceId" class="p-2.5 flex items-center gap-3 text-sm">
                <span class="font-medium">{{ v.name }}</span>
                <span class="text-xs text-muted">{{ v.language ?? '—' }} · {{ v.gender ?? '—' }}</span>
                <audio v-if="v.previewAudioUrl" :src="v.previewAudioUrl" controls preload="none" class="ms-auto h-8" />
              </div>
            </div>
            <RawJson :data="voices" class="mt-3" />
          </template>
        </UCard>

        <!-- Studio templates -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Studio templates</span>
              <UButton size="sm" icon="i-lucide-layout-template" label="List templates" :loading="loadingTemplates" @click="loadTemplates" />
            </div>
          </template>
          <div v-if="templates === null" class="text-sm text-muted py-4 text-center">
            Not loaded yet.
          </div>
          <template v-else>
            <div class="divide-y divide-default border border-default rounded-lg">
              <div v-for="t in templates" :key="t.templateId" class="p-2.5 flex items-center gap-3">
                <img v-if="t.thumbnailUrl" :src="t.thumbnailUrl" class="w-16 h-9 object-cover rounded" :alt="t.name">
                <span class="text-sm font-medium flex-1">{{ t.name }}</span>
                <UButton size="xs" variant="outline" color="neutral" label="Inspect variables" @click="inspectTemplate(t.templateId)" />
              </div>
            </div>
            <div v-if="inspectedTemplateId" class="mt-3">
              <p class="text-xs text-muted mb-1">
                Variables of {{ inspectedTemplateId }}:
              </p>
              <div v-if="templateVars" class="flex flex-wrap gap-1 mb-2">
                <UBadge v-for="(v, name) in templateVars" :key="name" color="neutral" variant="outline" size="sm" class="font-mono">
                  {{ name }} ({{ v.type }})
                </UBadge>
              </div>
              <RawJson v-if="templateVars" :data="templateVars" />
            </div>
          </template>
        </UCard>

        <!-- Generate -->
        <UCard>
          <template #header>
            <span class="font-medium">Generate a test video</span>
          </template>
          <div class="flex flex-col gap-3">
            <UAlert color="warning" variant="subtle" icon="i-lucide-circle-dollar-sign" title="This consumes HeyGen credits" description="Sync avatars and voices above first, then generate. Rendering takes a few minutes; status polls every 5s." />
            <div class="grid sm:grid-cols-2 gap-3">
              <UFormField label="Avatar">
                <USelectMenu v-model="gen.avatarId" value-key="value" :items="avatarOptions" :disabled="!avatarOptions.length" placeholder="List groups or sync avatars first" class="w-full" />
              </UFormField>
              <UFormField label="Voice">
                <USelectMenu v-model="gen.voiceId" value-key="value" :items="voiceOptions" :disabled="!voices?.length" placeholder="List voices first" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Script">
              <UTextarea v-model="gen.script" :rows="3" class="w-full" />
            </UFormField>
            <UButton icon="i-lucide-clapperboard" label="Generate video" :loading="generating" :disabled="!gen.avatarId || !gen.voiceId || !gen.script" class="self-start" @click="generate" />

            <div v-if="videoId" class="border border-default rounded-lg p-3 flex flex-col gap-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-muted">Video {{ videoId }}:</span>
                <StatusBadge v-if="videoStatus" :status="videoStatus.status.toUpperCase()" />
                <UIcon v-if="generating" name="i-lucide-loader-circle" class="animate-spin size-4 text-muted" />
              </div>
              <UAlert v-if="videoStatus?.error" color="error" variant="subtle" :title="videoStatus.error" />
              <video v-if="videoStatus?.videoUrl" :src="videoStatus.videoUrl" controls class="rounded-lg max-w-lg" />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
