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
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-muted">
          {{ label }}
        </p>
        <p class="text-2xl font-semibold mt-1">
          {{ value }}
        </p>
        <p v-if="sub" class="text-xs text-dimmed mt-1">
          {{ sub }}
        </p>
      </div>
      <UIcon v-if="icon" :name="icon" class="size-5 text-dimmed" />
    </div>
  </UCard>
</template>
