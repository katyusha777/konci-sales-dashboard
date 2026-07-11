<script setup lang="ts">
import { StatsApi } from '~/app/api/stats.api'

const { data: stats, status } = await useAsyncData('stats.overview', () => StatsApi.overview())

const maxFunnel = computed(() => Math.max(...(stats.value?.funnel.map(f => f.count) ?? [1])))
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Dashboard" />
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="animate-spin size-6 text-muted" />
      </div>

      <div v-else-if="stats" class="flex flex-col gap-6">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Sent today" :value="stats.sentToday" :sub="`${stats.sentYesterday} yesterday`" icon="i-lucide-send" />
          <StatCard label="Sent (30 days)" :value="stats.sent30d" :sub="`${stats.sent7d} last 7 days`" icon="i-lucide-calendar" />
          <StatCard label="Open rate" :value="formatPercent(stats.openRate)" :sub="`click rate ${formatPercent(stats.clickRate)}`" icon="i-lucide-mail-open" />
          <StatCard label="Total cost" :value="formatUsd(stats.totalCostUsd)" :sub="`${stats.videoPlays} video plays`" icon="i-lucide-circle-dollar-sign" />
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <UCard>
            <template #header>
              <span class="font-medium">Pipeline funnel</span>
            </template>
            <div class="flex flex-col gap-2">
              <div v-for="row in stats.funnel" :key="row.status" class="flex items-center gap-3">
                <div class="w-32 shrink-0">
                  <StatusBadge :status="row.status" />
                </div>
                <div class="flex-1 bg-elevated rounded h-5 overflow-hidden">
                  <div class="bg-primary/60 h-full rounded" :style="{ width: `${(row.count / maxFunnel) * 100}%` }" />
                </div>
                <span class="w-10 text-right text-sm text-muted">{{ row.count }}</span>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <span class="font-medium">Last 7 days</span>
            </template>
            <div class="flex flex-col gap-2">
              <div class="flex items-end gap-2 h-40">
                <div v-for="day in stats.sendsByDay" :key="day.date" class="flex-1 flex flex-col justify-end gap-0.5" :title="`${day.date}: ${day.sent} sent, ${day.opened} opened`">
                  <div class="bg-primary/70 rounded-t" :style="{ height: `${(day.sent / 30) * 100}%` }" />
                  <div class="bg-warning/60" :style="{ height: `${(day.opened / 30) * 100}%` }" />
                </div>
              </div>
              <div class="flex justify-between text-xs text-dimmed">
                <span>{{ stats.sendsByDay[0]?.date.slice(5) }}</span>
                <span class="flex gap-3">
                  <span class="flex items-center gap-1"><span class="size-2 rounded bg-primary/70 inline-block" /> sent</span>
                  <span class="flex items-center gap-1"><span class="size-2 rounded bg-warning/60 inline-block" /> opened</span>
                </span>
                <span>{{ stats.sendsByDay.at(-1)?.date.slice(5) }}</span>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
