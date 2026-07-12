<script setup lang="ts">
const props = defineProps<{ data: unknown, label?: string }>()
const json = computed(() => JSON.stringify(props.data, null, 2))
</script>

<template>
  <details class="border border-default rounded-lg">
    <summary class="px-3 py-2 text-xs text-muted cursor-pointer select-none">
      {{ label ?? 'Raw JSON' }}
    </summary>
    <pre class="text-xs p-3 pt-0 overflow-x-auto max-h-96 overflow-y-auto">{{ json }}</pre>
  </details>
</template>
