<script setup lang="ts">
import type { IEmailLiveResult } from '~/app/types'
import { ApiError } from '~/app/api/client'
import { PlaygroundApi } from '~/app/api/playground.api'
import { dummyTemplates } from '~/app/dummy-data/templates'

const { data: config, error: configError } = await useAsyncData('playground.emailConfig', () => PlaygroundApi.emailConfig())

const SAMPLE_VARS = {
  business_name: 'Lonestar Dental Care',
  contact_first_name: 'Sarah',
  industry: 'Dentist',
  city: 'Austin',
  video_url: 'https://konci-frontend.pages.dev/v/demo-token',
  demo_phone: '+1 (512) 555-9876',
  demo_pin: '4821',
  unsubscribe_url: 'https://konci-frontend.pages.dev/unsubscribe/demo',
}

const form = reactive({
  to: '',
  templateId: dummyTemplates[0]?.id,
  subject: '',
  html: '',
  withUnsubscribeHeaders: false,
})

const templateOptions = dummyTemplates.map(t => ({ label: t.name, value: t.id }))

// Prefill subject/body from the picked dummy template, rendered with the sample lead
watch(() => form.templateId, (id) => {
  const t = dummyTemplates.find(t => t.id === id)
  if (t) {
    form.subject = renderTemplate(t.subject, SAMPLE_VARS)
    form.html = renderTemplate(t.body, SAMPLE_VARS)
  }
}, { immediate: true })

const sending = ref(false)
const result = ref<IEmailLiveResult | null>(null)
const error = ref<ApiError | null>(null)

async function send() {
  sending.value = true
  error.value = null
  result.value = null
  try {
    result.value = await PlaygroundApi.emailSend({ to: form.to, subject: form.subject, html: form.html, withUnsubscribeHeaders: form.withUnsubscribeHeaders })
  }
  catch (err) {
    error.value = err as ApiError
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="playground-email">
    <template #header>
      <UDashboardNavbar title="Playground — Email (Resend)">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/playground" aria-label="Back" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-w-2xl">
        <UAlert
          v-if="configError"
          color="error" variant="subtle" icon="i-lucide-triangle-alert"
          :title="configError.message" :description="(configError as any).info ?? undefined"
        />
        <UAlert
          v-else-if="config"
          :color="config.testMode ? 'warning' : 'error'" variant="subtle" icon="i-lucide-flask-conical"
          :title="config.testMode
            ? `Test mode ON — whatever you put in 'To', the email actually goes to ${config.testRecipient}`
            : 'Test mode OFF — this sends to the REAL recipient'"
          :description="`From: ${config.from}`"
        />

        <UCard>
          <div class="flex flex-col gap-3">
            <UFormField label="To">
              <UInput v-model="form.to" type="email" placeholder="someone@business.com" class="w-full" />
            </UFormField>
            <UFormField label="Prefill from template" hint="rendered with the sample lead">
              <USelectMenu v-model="form.templateId" value-key="value" :items="templateOptions" class="w-full" />
            </UFormField>
            <UFormField label="Subject">
              <UInput v-model="form.subject" class="w-full" />
            </UFormField>
            <UFormField label="HTML body">
              <UTextarea v-model="form.html" :rows="10" class="w-full font-mono text-xs" />
            </UFormField>
            <UCheckbox v-model="form.withUnsubscribeHeaders" label="Attach List-Unsubscribe headers (RFC 8058 one-click — campaigns will always send these)" />
            <UButton icon="i-lucide-send" label="Send test email" :loading="sending" :disabled="!form.to || !form.subject || !form.html" class="self-start" @click="send" />
          </div>
        </UCard>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error.message" :description="error.info ?? undefined" />
        <UCard v-if="result">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
            <span>
              Sent! Resend id <code class="font-mono text-xs">{{ result.id }}</code> —
              delivered to <b>{{ result.to }}</b>
              <template v-if="result.testMode">
                (test mode; original recipient was {{ result.originalTo }})
              </template>
              <template v-if="result.unsubscribeHeaders">
                — with List-Unsubscribe headers (see raw JSON)
              </template>
            </span>
          </div>
          <RawJson :data="result" class="mt-3" />
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
