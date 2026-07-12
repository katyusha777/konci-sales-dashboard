<script setup lang="ts">
import type { ITemplate } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { AvatarsApi } from '~/app/api/avatars.api'
import { LeadsApi } from '~/app/api/leads.api'
import { TemplatesApi } from '~/app/api/templates.api'
import { VideosApi } from '~/app/api/video.api'
import { TEMPLATE_PLACEHOLDERS } from '~/app/constants/template'

const toast = useToast()

const { data: templates, refresh } = await useAsyncData('templates.list', () => TemplatesApi.list())
const { data: avatars } = await useAsyncData('avatars.list', () => AvatarsApi.list())
const { data: heygenTemplates } = await useAsyncData('templates.heygen', () => TemplatesApi.heygenTemplates())
// A sample lead to render the test video's placeholders against.
const { data: sampleLeads } = await useAsyncData('templates.sampleleads', () => LeadsApi.list({ perPage: 1 }))

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
    name: 'New template',
    subject: '',
    body: '',
    videoScript: null,
    videoScenes: null,
    avatarId: null,
    heygenTemplateId: null,
    createdAt: '',
    updatedAt: '',
  }
}

// --- Video mode -------------------------------------------------------------
type TVideoMode = 'none' | 'avatar' | 'heygen'
const videoMode = computed<TVideoMode>({
  get: () => {
    if (draft.value?.heygenTemplateId)
      return 'heygen'
    if (draft.value?.videoScript !== null && draft.value?.videoScript !== undefined)
      return 'avatar'
    return 'none'
  },
  set: (mode) => {
    if (!draft.value)
      return
    draft.value.videoScript = mode === 'avatar' ? (draft.value.videoScript ?? '') : null
    draft.value.heygenTemplateId = mode === 'heygen' ? (heygenTemplates.value?.[0]?.id ?? null) : null
    if (mode !== 'heygen')
      draft.value.videoScenes = null
    if (mode !== 'avatar')
      draft.value.avatarId = null
  },
})

const VIDEO_MODE_OPTIONS = [
  { label: 'No video', value: 'none' },
  { label: 'Avatar video (single script)', value: 'avatar' },
  { label: 'HeyGen template (scenes)', value: 'heygen' },
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

const avatarOptions = computed(() => (avatars.value ?? []).filter(a => a.isActive).map(a => ({ label: a.name, value: a.id })))
const heygenOptions = computed(() => (heygenTemplates.value ?? []).map(t => ({ label: `${t.name} (${t.sceneCount} scenes)`, value: t.id })))

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
    toast.add({ title: 'Click into a field first', description: 'Placeholders insert where the cursor is.', color: 'info' })
    return
  }
  const start = el.selectionStart ?? el.value.length
  el.setRangeText(token, start, el.selectionEnd ?? start, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}

// --- Validation & preview -----------------------------------------------------
const allTexts = computed(() => [
  draft.value?.subject ?? '',
  draft.value?.body ?? '',
  draft.value?.videoScript ?? '',
  ...(draft.value?.videoScenes ?? []),
].join('\n'))

const missingVars = computed(() =>
  extractTemplateVars(allTexts.value).filter(v => !TEMPLATE_PLACEHOLDERS.includes(v as typeof TEMPLATE_PLACEHOLDERS[number])),
)

const SAMPLE: Record<string, string> = {
  business_name: 'Lonestar Dental Care',
  contact_first_name: 'Sarah',
  industry: 'Dentist',
  city: 'Austin',
  video_url: '#video',
  demo_phone: '+1 (512) 555-9876',
  demo_pin: '4821',
  unsubscribe_url: '#unsubscribe',
}
// The variables this template uses in {{#if …}} conditionals — whatever they are.
const conditionalVars = computed(() => extractConditionalVars(allTexts.value))
// Toggle: preview the "empty" branch of every conditional (so you see how {{#if X}}…{{/if}}
// renders when its field has no value — for whatever fields you used, not just industry).
const previewEmptyOptional = ref(false)
const previewVars = computed(() => {
  const vars = { ...SAMPLE }
  if (previewEmptyOptional.value) {
    for (const v of conditionalVars.value)
      vars[v] = ''
  }
  return vars
})

const previewSubject = computed(() => renderTemplate(draft.value?.subject ?? '', previewVars.value))
const previewBody = computed(() => nl2br(renderTemplate(draft.value?.body ?? '', previewVars.value)))

async function save() {
  if (!draft.value)
    return
  const saved = await TemplatesApi.save(draft.value)
  await refresh()
  selectedId.value = saved.id
  draft.value = structuredClone(saved)
  toast.add({ title: 'Template saved', color: 'success' })
}

const generatingTestVideo = ref(false)
async function generateTestVideo() {
  if (!draft.value?.id) {
    toast.add({ title: 'Save the template first', description: 'A test video renders against the saved template.', color: 'info' })
    return
  }
  const sampleLead = sampleLeads.value?.items[0]
  if (!sampleLead) {
    toast.add({ title: 'No lead to sample', description: 'Add a lead first — the video needs a business to personalize for.', color: 'warning' })
    return
  }
  generatingTestVideo.value = true
  try {
    await VideosApi.generateTest(sampleLead.id, draft.value.id)
    toast.add({ title: 'Test video queued', description: `Rendering for ${sampleLead.name} — it appears on that lead once HeyGen finishes.`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not queue video', description: (err as ApiError).message, color: 'error' })
  }
  finally {
    generatingTestVideo.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="templates">
    <template #header>
      <UDashboardNavbar title="Templates">
        <template #right>
          <UButton icon="i-lucide-plus" label="New template" @click="createNew" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid lg:grid-cols-[16rem_1fr_1fr] gap-4 h-full">
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
                <UIcon v-if="t.videoScript !== null || t.heygenTemplateId" name="i-lucide-video" class="size-3" />
                {{ formatDate(t.updatedAt) }}
              </div>
            </button>
          </div>
        </UCard>

        <!-- Editor -->
        <UCard v-if="draft">
          <template #header>
            <span class="font-medium">{{ draft.id ? 'Edit' : 'New template' }}</span>
          </template>
          <div class="flex flex-col gap-3" @focusin="rememberField">
            <UFormField label="Name">
              <UInput v-model="draft.name" class="w-full" />
            </UFormField>
            <UFormField label="Subject">
              <UInput v-model="draft.subject" class="w-full" />
            </UFormField>
            <UFormField label="Body (HTML)">
              <UTextarea v-model="draft.body" :rows="9" class="w-full font-mono text-xs" />
            </UFormField>

            <USeparator label="Video" />
            <UFormField label="Video type">
              <USelect v-model="videoMode" :items="VIDEO_MODE_OPTIONS" value-key="value" class="w-full" />
            </UFormField>

            <template v-if="videoMode === 'avatar'">
              <UFormField label="Avatar">
                <USelectMenu v-model="draft.avatarId" value-key="value" :items="avatarOptions" placeholder="Pick an avatar" class="w-full" />
              </UFormField>
              <UFormField label="Video script">
                <UTextarea :model-value="draft.videoScript ?? ''" :rows="4" class="w-full" @update:model-value="draft.videoScript = $event as string" />
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
                v-for="v in TEMPLATE_PLACEHOLDERS" :key="v"
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
              Conditionals wrap a section that only shows when a field has a value — works for any
              placeholder, e.g. <code class="font-mono">{{ '\{\{#if city\}\}based in \{\{city\}\}\{\{/if\}\}' }}</code>.
            </p>

            <UAlert v-if="missingVars.length" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="`Unknown placeholder(s): ${missingVars.join(', ')}`" />
            <div class="flex gap-2">
              <UButton label="Save" :disabled="!draft.name || missingVars.length > 0" @click="save" />
              <UButton
                v-if="videoMode !== 'none'" icon="i-lucide-clapperboard" color="neutral" variant="outline" label="Generate test video"
                :loading="generatingTestVideo" @click="generateTestVideo"
              />
            </div>
          </div>
        </UCard>

        <!-- Preview -->
        <UCard v-if="draft">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">Preview <span class="text-xs text-muted font-normal">(sample: Lonestar Dental Care)</span></span>
              <USwitch
                v-if="conditionalVars.length"
                v-model="previewEmptyOptional"
                :label="`Empty ${conditionalVars.join(', ')}`"
                size="sm"
              />
            </div>
          </template>
          <div class="flex flex-col gap-3">
            <div class="border-b border-default pb-2">
              <span class="text-xs text-muted">Subject</span>
              <p class="font-medium text-sm">
                {{ previewSubject || '—' }}
              </p>
            </div>
            <!-- Dummy content preview only — sanitization handled when backend renders real emails -->
            <div class="prose prose-sm dark:prose-invert max-w-none text-sm" v-html="previewBody" />
            <div v-if="videoMode === 'avatar' && draft.videoScript" class="border-t border-default pt-2">
              <span class="text-xs text-muted">Video script</span>
              <p class="text-sm italic">
                “{{ renderTemplate(draft.videoScript, previewVars) }}”
              </p>
            </div>
            <div v-if="videoMode === 'heygen'" class="border-t border-default pt-2 flex flex-col gap-2">
              <span class="text-xs text-muted">{{ selectedHeygenTemplate?.name }}</span>
              <div v-for="(scene, i) in draft.videoScenes" :key="i" class="text-sm">
                <UBadge color="neutral" variant="outline" size="sm" class="me-2">
                  Scene {{ i + 1 }}
                </UBadge>
                <span class="italic">“{{ renderTemplate(scene, previewVars) || '—' }}”</span>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
