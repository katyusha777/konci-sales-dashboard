<script setup lang="ts">
// The ONLY place any status enum maps to a color/label. Never inline this in pages.
const props = defineProps<{ status: string }>()

const MAP: Record<string, { label: string, color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'neutral' }> = {
  // Lead status
  NEW: { label: 'New', color: 'neutral' },
  ENRICHED: { label: 'Enriched', color: 'info' },
  IN_CAMPAIGN: { label: 'In campaign', color: 'primary' },
  CONTACTED: { label: 'Contacted', color: 'primary' },
  ENGAGED: { label: 'Engaged', color: 'warning' },
  REPLIED: { label: 'Replied', color: 'success' },
  CLOSED_WON: { label: 'Won', color: 'success' },
  CLOSED_LOST: { label: 'Lost', color: 'error' },
  DO_NOT_CONTACT: { label: 'Do not contact', color: 'error' },
  // Enrichment status
  PENDING: { label: 'Pending', color: 'neutral' },
  IN_PROGRESS: { label: 'In progress', color: 'info' },
  COMPLETED: { label: 'Completed', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
  SKIPPED: { label: 'Skipped', color: 'neutral' },
  // Campaign status
  DRAFT: { label: 'Draft', color: 'neutral' },
  ACTIVE: { label: 'Active', color: 'success' },
  PAUSED: { label: 'Paused', color: 'warning' },
  // Campaign lead / email status
  SCHEDULED: { label: 'Scheduled', color: 'info' },
  SENT: { label: 'Sent', color: 'primary' },
  DELIVERED: { label: 'Delivered', color: 'primary' },
  OPENED: { label: 'Opened', color: 'warning' },
  CLICKED: { label: 'Clicked', color: 'warning' },
  BOUNCED: { label: 'Bounced', color: 'error' },
  COMPLAINED: { label: 'Complained', color: 'error' },
  CANCELLED: { label: 'Cancelled', color: 'neutral' },
  SUPPRESSED: { label: 'Suppressed', color: 'error' },
  // Contact email status
  UNKNOWN: { label: 'Unknown', color: 'neutral' },
  VALID: { label: 'Valid', color: 'success' },
  UNSUBSCRIBED: { label: 'Unsubscribed', color: 'error' },
}

const entry = computed(() => MAP[props.status] ?? { label: props.status, color: 'neutral' as const })
</script>

<template>
  <UBadge :color="entry.color" variant="subtle">
    {{ entry.label }}
  </UBadge>
</template>
