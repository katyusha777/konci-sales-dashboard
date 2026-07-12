<script setup lang="ts">
// Quick-fill chips for playground forms — each sample prefills the form, it never fires the call.
defineProps<{ samples: Array<{ label: string, apply: () => void }> }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <UIcon name="i-lucide-wand-sparkles" class="size-3.5 text-dimmed shrink-0" />
    <UButton
      v-for="s in samples" :key="s.label"
      size="xs" color="neutral" variant="soft" :label="s.label"
      @click="s.apply()"
    />
  </div>
</template>
