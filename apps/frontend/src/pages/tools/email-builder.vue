<script setup lang="ts">
import type { IBuiltEmail } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { ToolsApi } from '~/app/api/tools.api'

const toast = useToast()

const instructions = ref('')

const samples = [
  { label: 'Intro w/ video + demo line', apply: () => instructions.value = 'Short cold intro email to a local business owner. We already built them a personalized demo: include the demo video, the personal phone number they can call to hear Konci answering as their business (with the PIN), and the link to claim their ready-made dashboard. Friendly, no hard sell, under 100 words.' },
  { label: 'Follow-up (no reply)', apply: () => instructions.value = 'Polite 3-sentence follow-up to someone who didn\'t reply to the first email. Remind them their demo line is still live — they can call it with the PIN — and their dashboard is one click away. Light, human tone.' },
  { label: 'Convert my draft', apply: () => instructions.value = 'Convert this draft into a Smartlead-ready email (replace concrete values with merge tags):\n\n' },
]

// Reference list mirrors the tags the API prompt allows (buildOutreachEmail).
const TAGS = [
  ['{{first_name}}', 'contact first name'],
  ['{{last_name}}', 'contact last name'],
  ['{{business_name}}', 'business name'],
  ['{{industry}}', 'industry'],
  ['{{city}}', 'city'],
  ['{{demo_phone}}', 'personal Konci demo number (display)'],
  ['{{demo_phone_e164}}', 'raw +1… number for tel: links'],
  ['{{demo_pin}}', 'PIN for the demo line'],
  ['{{claim_url}}', 'claim link for their dashboard'],
  ['{{video_url}}', 'personalized video link'],
  ['{{video_thumbnail}}', 'video thumbnail image'],
]

const loading = ref(false)
const result = ref<IBuiltEmail | null>(null)
const error = ref<ApiError | null>(null)

async function build() {
  loading.value = true
  error.value = null
  try {
    result.value = await ToolsApi.buildEmail(instructions.value.trim())
  }
  catch (err) {
    error.value = err as ApiError
  }
  finally {
    loading.value = false
  }
}

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: `${what} copied`, color: 'success' })
}
</script>

<template>
  <UDashboardPanel id="tools-email-builder">
    <template #header>
      <UDashboardNavbar title="Tools — Email builder" />
    </template>

    <template #body>
      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Left: input -->
        <div class="flex flex-col gap-3">
          <UCard>
            <template #header>
              <span class="font-medium">Describe the email <span class="text-xs text-muted font-normal">(or paste a draft to convert)</span></span>
            </template>
            <div class="flex flex-col gap-3">
              <SampleChips :samples="samples" />
              <UTextarea v-model="instructions" :rows="10" class="w-full" placeholder="e.g. Short intro email for restaurant owners — mention the demo video and the phone number they can call to try Konci live…" />
              <UButton icon="i-lucide-sparkles" label="Build email" :loading="loading" :disabled="!instructions.trim()" class="self-start" @click="build" />
              <p class="text-xs text-dimmed">
                Live LLM call — ~$0.002 (Llama 4 Maverick via OpenRouter).
              </p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <span class="font-medium text-sm">Available Smartlead tags <span class="text-xs text-muted font-normal">— filled per lead at send time</span></span>
            </template>
            <div class="divide-y divide-default -my-2">
              <div v-for="[tag, desc] in TAGS" :key="tag" class="py-1.5 text-sm flex items-center gap-2">
                <button type="button" class="font-mono text-xs text-primary" @click="copy(tag, tag)">{{ tag }}</button>
                <span class="text-xs text-muted ms-auto">{{ desc }}</span>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Right: output -->
        <div class="flex flex-col gap-3">
          <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />

          <template v-if="result">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm">Subject</span>
                  <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" class="ms-auto" aria-label="Copy subject" @click="copy(result.subject, 'Subject')" />
                </div>
              </template>
              <p class="text-sm">{{ result.subject }}</p>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm">Body <span class="text-xs text-muted font-normal">— copy the HTML into the Smartlead sequence editor</span></span>
                  <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="ghost" class="ms-auto" aria-label="Copy body HTML" @click="copy(result.body, 'Body HTML')" />
                </div>
              </template>
              <div class="flex flex-col gap-3">
                <!-- Rendered preview — our own LLM output, merge tags show as literal {{…}} -->
                <div class="text-sm" v-html="result.body" />
                <USeparator />
                <pre class="text-xs whitespace-pre-wrap font-mono text-muted">{{ result.body }}</pre>
              </div>
            </UCard>

            <RawJson :data="result.raw" />
          </template>

          <div v-else-if="!error" class="text-sm text-muted py-12 text-center rounded-xl bg-default shadow-sm">
            Describe what you want (or paste a draft) — the Smartlead-tagged subject and body appear here.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
