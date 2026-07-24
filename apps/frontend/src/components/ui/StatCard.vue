<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon?: string
  sub?: string
}>()
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[0.6875rem] font-semibold uppercase tracking-wider text-dimmed">
          {{ label }}
        </p>
        <p class="text-3xl font-bold tracking-tight tabular-nums mt-1.5">
          {{ value }}
        </p>
        <p v-if="sub" class="text-xs text-dimmed mt-1">
          {{ sub }}
        </p>
      </div>
      <div v-if="icon" class="size-9 rounded-lg bg-elevated flex items-center justify-center shrink-0">
        <UIcon :name="icon" class="size-4.5 text-muted" />
      </div>
    </div>
  </UCard>
</template>
