<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope } from 'timescope';
import { comparisonSamples } from './comparison-data.js';
import sampleCode from './comparison-data.js?raw';
import { expression, vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const overlay = ref(false);
const shared = ref(true);
const samples = comparisonSamples();
let timescope: Timescope | undefined;
const options = computed(() => ({
  style: { height: '360px' },
  sources: { samples },
  domains: { temperature: { range: [10, 50] as [number, number], unit: '°C', axis: 'left' as const } },
  series: {
    intake: {
      data: {
        source: 'samples',
        name: 'Intake',
        color: '#0284c7',
        instantaneous: { using: 'intake' },
        domain: shared.value
          ? 'temperature'
          : { range: [10, 30] as [number, number], unit: '°C', axis: 'left' as const },
      },
      chart: { links: [{ draw: 'line' as const, using: 'intake', style: { lineWidth: 2 } }] },
      track: 'intake',
    },
    outlet: {
      data: {
        source: 'samples',
        name: 'Outlet',
        color: '#f97316',
        instantaneous: { using: 'outlet' },
        domain: shared.value
          ? 'temperature'
          : { range: [20, 50] as [number, number], unit: '°C', axis: 'right' as const },
      },
      chart: { links: [{ draw: 'line' as const, using: 'outlet', style: { lineWidth: 2 } }] },
      track: overlay.value ? 'intake' : 'outlet',
    },
    flow: {
      data: {
        source: 'samples',
        name: 'Flow',
        color: '#8b5cf6',
        instantaneous: { using: 'flow' },
        domain: { range: [0, 100] as [number, number], unit: 'L/min', axis: 'left' as const },
      },
      chart: {
        links: [
          { draw: 'area' as const, using: ['flow', '#zero'] as [string, string], style: { fillOpacity: 0.2 } },
          { draw: 'line' as const, using: 'flow', style: { lineWidth: 1.5 } },
        ],
      },
      track: 'flow',
    },
  },
  tracks: {
    intake: { height: overlay.value ? 240 : 120, timeAxis: false },
    ...(!overlay.value ? { outlet: { height: 120, timeAxis: false } } : {}),
    flow: { height: 120, timeAxis: { relative: true } },
  },
}));
onMounted(() => {
  timescope = new Timescope({ ...options.value, target: target.value!, time: 30, zoom: 4 });
  timescope.fitTo([0, 60], { animation: false });
});
// Replacement removes the unused track when temperatures are overlaid.
watch(options, (value) => timescope?.setOptions(value));
onBeforeUnmount(() => timescope?.dispose());
defineExpose({
  exportCode: () =>
    vanillaCode(
      { ...options.value, time: 30, zoom: 4, sources: { samples: expression('comparisonSamples()') } },
      sampleCode,
      'timescope.fitTo([0, 60], { animation: false });',
    ),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button :aria-pressed="!overlay" @click="overlay = false">Separate tracks</button>
      <button :aria-pressed="overlay" @click="overlay = true">Overlay temperatures</button>
      <label><input v-model="shared" type="checkbox" /> Shared temperature scale</label>
      <button @click="timescope?.fitTo([0, 60], { animation: false })">Fit cycle</button>
    </div>
    <div ref="target"></div>
    <p class="demo-note">
      Blue: intake · Orange: outlet · Purple: flow. Tracks share time; Domains determine whether values share a scale.
    </p>
  </div>
</template>

<style src="./demo.css"></style>
