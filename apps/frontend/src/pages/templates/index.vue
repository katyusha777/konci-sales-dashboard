<script setup lang="ts">
import type { ITemplate } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { AvatarsApi } from '~/app/api/avatars.api'
import { LeadsApi } from '~/app/api/leads.api'
import { TemplatesApi } from '~/app/api/templates.api'
import { VideosApi } from '~/app/api/video.api'
import { VIDEO_PLACEHOLDERS } from '~/app/constants/template'

const toast = useToast()

const { data: templates, refresh } = await useAsyncData('templates.list', () => TemplatesApi.list())
const { data: avatars } = await useAsyncData('avatars.list', () => AvatarsApi.list())
const { data: voices } = await useAsyncData('templates.voices', () => TemplatesApi.voices())
const { data: heygenTemplates } = await useAsyncData('templates.heygen', () => TemplatesApi.heygenTemplates())
// Real leads to preview placeholders against (and to render the test video for).
const { data: sampleLeads } = await useAsyncData('templates.sampleleads', () => LeadsApi.list({ perPage: 50 }))

const sampleLeadId = ref<string | undefined>()
watch(sampleLeads, (l) => {
  if (!sampleLeadId.value && l?.items.length)
    sampleLeadId.value = l.items[0]!.id
}, { immediate: true })
const sampleLead = computed(() => sampleLeads.value?.items.find(l => l.id === sampleLeadId.value))
const sampleOptions = computed(() => (sampleLeads.value?.items ?? []).map(l => ({
  label: l.city ? `${l.name} — ${l.city}` : l.name,
  value: l.id,
})))

const selectedId = ref<string | null>(null)
const draft = ref<ITemplate | null>(null)

function select(id: string) {
  const t = templates.value?.find(t => t.id === id)
  if (!t)
    return
  selectedId.value = id
  draft.value = structuredClone(toRaw(t))
}

// Auto-select the first template on load
watch(templates, (list) => {
  if (!draft.value && list?.length)
    select(list[0]!.id)
}, { immediate: true })

function createNew() {
  selectedId.value = null
  draft.value = {
    id: '',
    name: 'New video template',
    videoScript: '',
    videoScenes: null,
    avatarId: null,
    voiceId: null,
    heygenTemplateId: null,
    createdAt: '',
    updatedAt: '',
  }
}

// --- Video mode -------------------------------------------------------------
type TVideoMode = 'avatar' | 'heygen'
const videoMode = computed<TVideoMode>({
  get: () => draft.value?.heygenTemplateId ? 'heygen' : 'avatar',
  set: (mode) => {
    if (!draft.value)
      return
    draft.value.videoScript = mode === 'avatar' ? (draft.value.videoScript ?? '') : null
    draft.value.heygenTemplateId = mode === 'heygen' ? (heygenTemplates.value?.[0]?.id ?? null) : null
    if (mode !== 'heygen')
      draft.value.videoScenes = null
    if (mode !== 'avatar') {
      draft.value.avatarId = null
      draft.value.voiceId = null
    }
  },
})

const VIDEO_MODE_OPTIONS = [
  { label: 'Avatar video (single script)', value: 'avatar' },
  { label: 'HeyGen studio template (scenes)', value: 'heygen' },
]

const selectedHeygenTemplate = computed(() => heygenTemplates.value?.find(t => t.id === draft.value?.heygenTemplateId))

// Keep the scenes array sized to the selected HeyGen template
watch([() => draft.value?.heygenTemplateId, heygenTemplates], () => {
  if (!draft.value || !selectedHeygenTemplate.value)
    return
  const count = selectedHeygenTemplate.value.sceneCount
  const scenes = draft.value.videoScenes ?? []
  draft.value.videoScenes = Array.from({ length: count }, (_, i) => scenes[i] ?? '')
}, { immediate: true })

const activeAvatars = computed(() => (avatars.value ?? []).filter(a => a.isActive))
const selectedAvatar = computed(() => activeAvatars.value.find(a => a.id === draft.value?.avatarId))
const heygenOptions = computed(() => (heygenTemplates.value ?? []).map(t => ({ label: `${t.name} (${t.sceneCount} scenes)`, value: t.id })))

// Voice picker: template override, or fall back to the avatar's configured voice.
const AVATAR_VOICE = '__avatar__'
const voiceOptions = computed(() => [
  { label: 'Avatar’s configured voice', value: AVATAR_VOICE },
  ...(voices.value ?? []).map(v => ({ label: `${v.name}${v.language ? ` (${v.language})` : ''}`, value: v.voiceId })),
])
const voiceChoice = computed<string>({
  get: () => draft.value?.voiceId ?? AVATAR_VOICE,
  set: (v) => {
    if (draft.value)
      draft.value.voiceId = v === AVATAR_VOICE ? null : v
  },
})
const voiceName = computed(() => {
  if (!draft.value?.voiceId)
    return 'avatar’s voice'
  return voices.value?.find(v => v.voiceId === draft.value?.voiceId)?.name ?? draft.value.voiceId
})

// --- Clickable placeholders ---------------------------------------------------
// Remember the last focused input/textarea in the editor; badge clicks insert there.
const lastField = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
function rememberField(e: FocusEvent) {
  const t = e.target
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
    lastField.value = t
}

function insertToken(token: string) {
  const el = lastField.value
  if (!el) {
    toast.add({ title: 'Click into the script first', description: 'Placeholders insert where the cursor is.', color: 'info' })
    return
  }
  const start = el.selectionStart ?? el.value.length
  el.setRangeText(token, start, el.selectionEnd ?? start, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}

// --- Validation & preview -----------------------------------------------------
const allTexts = computed(() => [
  draft.value?.videoScript ?? '',
  ...(draft.value?.videoScenes ?? []),
].join('\n'))

const missingVars = computed(() =>
  extractTemplateVars(allTexts.value).filter(v => !VIDEO_PLACEHOLDERS.includes(v as typeof VIDEO_PLACEHOLDERS[number])),
)

// Fallback sample when there are no leads yet. demo phone/PIN also fall back here —
// most leads don't have them until Konci registration, and a blank hole reads worse.
const SAMPLE: Record<string, string> = {
  business_name: 'Lonestar Dental Care',
  contact_first_name: 'Sarah',
  industry: 'Dentist',
  city: 'Austin',
  demo_phone: '+1 (512) 555-9876',
  demo_pin: '4821',
}
// The variables this template uses in {{#if …}} conditionals — whatever they are.
const conditionalVars = computed(() => extractConditionalVars(allTexts.value))
// Toggle: preview the "empty" branch of every conditional.
const previewEmptyOptional = ref(false)
const previewVars = computed(() => {
  const l = sampleLead.value
  const vars = l
    ? {
        business_name: l.name,
        contact_first_name: l.ownerName?.split(' ')[0] ?? '',
        industry: l.industry ?? '',
        city: l.city ?? '',
        demo_phone: l.demoPhone ?? SAMPLE.demo_phone!,
        demo_pin: l.demoPin ?? SAMPLE.demo_pin!,
      }
    : { ...SAMPLE }
  if (previewEmptyOptional.value) {
    for (const v of conditionalVars.value)
      vars[v as keyof typeof vars] = ''
  }
  return vars
})

const canSave = computed(() => {
  if (!draft.value?.name?.trim() || missingVars.value.length > 0)
    return false
  if (videoMode.value === 'avatar')
    return !!draft.value.avatarId && !!draft.value.videoScript?.trim()
  return !!draft.value.heygenTemplateId
})

async function save() {
  if (!draft.value)
    return
  try {
    const saved = await TemplatesApi.save(draft.value)
    await refresh()
    selectedId.value = saved.id
    draft.value = structuredClone(saved)
    toast.add({ title: 'Template saved', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not save template', description: (err as ApiError).message, color: 'error' })
  }
}

const generatingTestVideo = ref(false)
async function generateTestVideo() {
  if (!draft.value?.id) {
    toast.add({ title: 'Save the template first', description: 'A test video renders against the saved template.', color: 'info' })
    return
  }
  const lead = sampleLead.value
  if (!lead) {
    toast.add({ title: 'No lead to sample', description: 'Add a lead first — the video needs a business to personalize for.', color: 'warning' })
    return
  }
  generatingTestVideo.value = true
  try {
    await VideosApi.generate(lead.id, draft.value.id, true)
    toast.add({ title: 'Test video queued', description: `Rendering for ${lead.name} — it appears on that lead once HeyGen finishes.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not queue video', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    generatingTestVideo.value = false
  }
}

// --- Delete -------------------------------------------------------------------
const deleteModalOpen = ref(false)
const deleting = ref(false)
async function deleteTemplate() {
  if (!draft.value?.id)
    return
  deleting.value = true
  try {
    await TemplatesApi.remove(draft.value.id)
    deleteModalOpen.value = false
    toast.add({ title: `Template “${draft.value.name}” deleted`, description: 'Videos already rendered from it are untouched.', color: 'success' })
    selectedId.value = null
    draft.value = null
    await refresh()
    if (templates.value?.length)
      select(templates.value[0]!.id)
  }
  catch (err) {
    toast.add({ title: 'Could not delete template', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="templates">
    <template #header>
      <UDashboardNavbar title="Video templates">
        <template #right>
          <UButton icon="i-lucide-plus" label="New template" @click="createNew" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- No h-full: the panel body is the scroll container; pinning the grid to it broke scrolling. -->
      <div class="grid lg:grid-cols-[16rem_1fr_1fr] gap-4 lg:items-start">
        <!-- List -->
        <UCard :ui="{ body: 'p-2 sm:p-2' }">
          <div class="flex flex-col gap-1">
            <button
              v-for="t in templates" :key="t.id"
              type="button"
              class="text-left px-3 py-2 rounded-md hover:bg-elevated text-sm"
              :class="{ 'bg-elevated font-medium': selectedId === t.id }"
              @click="select(t.id)"
            >
              <div class="truncate">
                {{ t.name }}
              </div>
              <div class="text-xs text-muted flex items-center gap-1">
                <UIcon name="i-lucide-video" class="size-3" />
                {{ formatDate(t.updatedAt) }}
              </div>
            </button>
          </div>
        </UCard>

        <!-- Editor -->
        <UCard v-if="draft">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ draft.id ? 'Edit' : 'New video template' }}</span>
              <UButton
                v-if="draft.id"
                icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="Delete template"
                @click="deleteModalOpen = true"
              />
            </div>
          </template>
          <div class="flex flex-col gap-3" @focusin="rememberField">
            <UFormField label="Name">
              <UInput v-model="draft.name" class="w-full" />
            </UFormField>

            <UFormField label="Video type">
              <USelect v-model="videoMode" :items="VIDEO_MODE_OPTIONS" value-key="value" class="w-full" />
            </UFormField>

            <template v-if="videoMode === 'avatar'">
              <UFormField label="Avatar">
                <div v-if="!activeAvatars.length" class="text-sm text-muted">
                  No active avatars — sync/activate them on the <NuxtLink to="/avatars" class="text-primary">
                    Avatars
                  </NuxtLink> page.
                </div>
                <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <button
                    v-for="a in activeAvatars" :key="a.id"
                    type="button"
                    class="rounded-lg overflow-hidden text-left ring-2 transition"
                    :class="draft.avatarId === a.id ? 'ring-primary' : 'ring-transparent hover:ring-primary/40'"
                    @click="draft.avatarId = a.id"
                  >
                    <img v-if="a.previewImageUrl" :src="a.previewImageUrl" :alt="a.name" class="aspect-square object-cover w-full bg-elevated">
                    <div v-else class="aspect-square w-full bg-elevated flex items-center justify-center">
                      <UIcon name="i-lucide-user-round" class="size-6 text-muted" />
                    </div>
                    <div class="text-xs truncate px-1.5 py-1" :class="{ 'font-medium': draft.avatarId === a.id }">
                      {{ a.name }}
                    </div>
                  </button>
                </div>
              </UFormField>

              <UFormField label="Voice" help="Defaults to the voice configured on the avatar.">
                <USelectMenu v-model="voiceChoice" value-key="value" :items="voiceOptions" class="w-full" />
              </UFormField>

              <UFormField label="Video script" help="What the avatar says — spoken aloud, so keep placeholders natural.">
                <UTextarea :model-value="draft.videoScript ?? ''" :rows="7" class="w-full" @update:model-value="draft.videoScript = $event as string" />
              </UFormField>
            </template>

            <template v-if="videoMode === 'heygen'">
              <UFormField label="HeyGen studio template">
                <USelectMenu v-model="draft.heygenTemplateId" value-key="value" :items="heygenOptions" class="w-full" />
              </UFormField>
              <UFormField
                v-for="(_, i) in draft.videoScenes" :key="i"
                :label="`Scene ${i + 1}`"
              >
                <UTextarea v-model="draft.videoScenes![i]" :rows="3" class="w-full" />
              </UFormField>
            </template>

            <USeparator label="Placeholders — click to insert" />
            <div class="flex flex-wrap gap-1">
              <UButton
                v-for="v in VIDEO_PLACEHOLDERS" :key="v"
                color="neutral" variant="outline" size="xs" class="font-mono"
                :label="`{{${v}}}`"
                @mousedown.prevent="insertToken(`{{${v}}}`)"
              />
              <UButton
                color="neutral" variant="outline" size="xs" class="font-mono"
                label="{{#if …}}"
                @mousedown.prevent="insertToken('{{#if field}} {{/if}}')"
              />
            </div>
            <p class="text-xs text-muted">
              Conditionals wrap a section that only shows when a field has a value, e.g.
              <code class="font-mono">{{ '\{\{#if city\}\}here in \{\{city\}\}\{\{/if\}\}' }}</code>.
            </p>

            <UAlert v-if="missingVars.length" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="`Unknown placeholder(s): ${missingVars.join(', ')}`" />
            <div class="flex gap-2">
              <UButton label="Save" :disabled="!canSave" @click="save" />
              <UButton
                icon="i-lucide-clapperboard" color="neutral" variant="outline" label="Generate test video"
                :loading="generatingTestVideo" @click="generateTestVideo"
              />
            </div>
          </div>
        </UCard>

        <!-- Preview -->
        <UCard v-if="draft">
          <template #header>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="font-medium">Preview</span>
              <USelectMenu
                v-if="sampleOptions.length"
                v-model="sampleLeadId" value-key="value" :items="sampleOptions"
                size="xs" class="w-52" placeholder="Sample lead…"
              />
            </div>
          </template>
          <div class="flex flex-col gap-4">
            <USwitch
              v-if="conditionalVars.length"
              v-model="previewEmptyOptional"
              :label="`Preview with empty ${conditionalVars.join(', ')}`"
              size="sm"
            />
            <div v-if="videoMode === 'avatar'" class="flex items-center gap-3">
              <img
                v-if="selectedAvatar?.previewImageUrl"
                :src="selectedAvatar.previewImageUrl" :alt="selectedAvatar.name"
                class="size-20 rounded-lg object-cover bg-elevated"
              >
              <div v-else class="size-20 rounded-lg bg-elevated flex items-center justify-center">
                <UIcon name="i-lucide-user-round" class="size-8 text-muted" />
              </div>
              <div class="text-sm">
                <p class="font-medium">
                  {{ selectedAvatar?.name ?? 'No avatar selected' }}
                </p>
                <p class="text-xs text-muted">
                  Voice: {{ voiceName }}
                </p>
              </div>
            </div>

            <div v-if="videoMode === 'avatar'" class="border-t border-default pt-3">
              <span class="text-xs text-muted">Spoken script</span>
              <p class="text-sm italic whitespace-pre-wrap">
                “{{ renderTemplate(draft.videoScript ?? '', previewVars) || '—' }}”
              </p>
            </div>

            <div v-if="videoMode === 'heygen'" class="flex flex-col gap-2">
              <span class="text-xs text-muted">{{ selectedHeygenTemplate?.name }}</span>
              <div v-for="(scene, i) in draft.videoScenes" :key="i" class="text-sm">
                <UBadge color="neutral" variant="outline" size="sm" class="me-2">
                  Scene {{ i + 1 }}
                </UBadge>
                <span class="italic">“{{ renderTemplate(scene, previewVars) || '—' }}”</span>
              </div>
            </div>

            <UAlert
              color="info" variant="subtle" icon="i-lucide-mail"
              title="Where the email fits"
              description="Email copy lives in Smartlead. When a lead's video is ready, the sync pushes video_url + video_thumbnail custom fields — the Smartlead template shows a clickable video image via {{#if video_url}} … {{/if}}."
            />
          </div>
        </UCard>
      </div>

      <!-- Delete confirm -->
      <UModal v-model:open="deleteModalOpen" title="Delete template?" :description="`“${draft?.name}” will be removed. Videos already rendered from it stay.`">
        <template #footer>
          <UButton color="neutral" variant="ghost" label="Cancel" @click="deleteModalOpen = false" />
          <UButton color="error" label="Delete template" :loading="deleting" @click="deleteTemplate" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
