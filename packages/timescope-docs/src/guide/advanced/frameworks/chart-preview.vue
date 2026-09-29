<script setup lang="ts">
import { Timescope, defineTimescopeOptions, Decimal } from '@timescope/vue';
import { ref, shallowRef } from 'vue';

const time = shallowRef<Decimal | null>(Decimal(15));
const zoom = ref(3);
const options = defineTimescopeOptions({
  style: { height: '240px' },
  sources: {
    values: [
      { time: 0, value: 1 },
      { time: 15, value: 3 },
      { time: 30, value: 2 },
    ],
  },
  series: { values: { data: { source: 'values', color: '#0d9488' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});
</script>

<template>
  <div class="chart-preview">
    <Timescope v-model:time="time" v-model:zoom="zoom" :options="options" />
    <div class="chart-state">
      <button type="button" @click="time = Decimal(15)">Center at 15</button>
      <output>Time: {{ time?.toString() ?? 'live' }} · Zoom: {{ zoom.toFixed(2) }}</output>
    </div>
  </div>
  <p class="preview-note">Shared chart preview, rendered with the Vue binding. Drag to pan; scroll to zoom.</p>
</template>

<style scoped>
.chart-preview {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.chart-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
}

.chart-state button {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.chart-state button:hover {
  border-color: var(--vp-c-brand-1);
}

.chart-state output {
  overflow-wrap: anywhere;
}

.preview-note {
  color: var(--vp-c-text-2);
  font-size: 13px;
}
</style>
