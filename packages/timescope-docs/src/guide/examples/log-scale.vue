<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope } from 'timescope';
import { decaySamples } from './decay-data.js';
import sampleCode from './decay-data.js?raw';
import { expression, vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const scale = ref<'linear' | 'log'>('log');
const points = ref(false);
const samples = decaySamples();
let timescope: Timescope | undefined;
const options = computed(() => ({
  style: { height: '340px' },
  sources: { samples },
  series: {
    response: {
      data: {
        source: 'samples',
        name: 'Response time',
        color: '#d97706',
        domain: {
          scale: scale.value,
          range: [0.01, 20000] as [number, number],
          unit: 'ms',
          digits: 2,
          axis: 'left' as const,
        },
      },
      chart: points.value ? ('linespoints' as const) : ('lines' as const),
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
}));
onMounted(() => {
  timescope = new Timescope({ ...options.value, target: target.value!, time: 30, zoom: 4 });
  timescope.fitTo([0, 60], { animation: false });
});
watch(options, (value) => timescope?.updateOptions(value));
onBeforeUnmount(() => timescope?.dispose());
defineExpose({
  exportCode: () =>
    vanillaCode(
      { ...options.value, time: 30, zoom: 4, sources: { samples: expression('decaySamples()') } },
      sampleCode,
      'timescope.fitTo([0, 60], { animation: false });',
    ),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button :aria-pressed="scale === 'linear'" @click="scale = 'linear'">Linear</button>
      <button :aria-pressed="scale === 'log'" @click="scale = 'log'">Logarithmic</button>
      <label><input v-model="points" type="checkbox" /> Show samples</label>
      <button @click="timescope?.fitTo([0, 60], { animation: false })">Fit recording</button>
    </div>
    <div ref="target"></div>
    <p class="demo-note">
      Same positive samples, same bounds. Log reveals the small retry spike at 44 s as the response time falls from
      seconds to fractions of a millisecond.
    </p>
  </div>
</template>

<style src="./demo.css"></style>
