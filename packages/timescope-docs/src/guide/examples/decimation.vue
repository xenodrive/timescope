<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope, type TimescopeChartLink, type TimescopeSeriesInput } from 'timescope';
import { vibrationSamples } from './vibration-data.js';
import sampleCode from './vibration-data.js?raw';
import { expression, vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const envelope = ref(true);
const selectedRange = ref<[number, number]>([0, 12]);
let timescope: Timescope | undefined;
// A fixed high-density recording, not a resolution-dependent loader.
const sampleRate = 4096;
const data = vibrationSamples();
function chart(): NonNullable<TimescopeSeriesInput['chart']> {
  const links: TimescopeChartLink<false>[] = [];
  if (envelope.value)
    links.push({ draw: 'area', using: ['value#min', 'value#max'], style: { fillColor: '#8b5cf6', fillOpacity: 0.4 } });
  links.push({ draw: 'line', using: 'value#avg', style: { lineColor: '#6d28d9', lineWidth: 1.5 } });
  return {
    links,
    marks: ({ resolution }) =>
      resolution.le(1 / 4096)
        ? [{ draw: 'circle', using: 'value#avg', style: { size: 5, lineColor: '#6d28d9', fillColor: '#ede9fe' } }]
        : [],
  };
}
function view(range: [number, number]) {
  selectedRange.value = range;
  timescope?.fitTo(range, { animation: false });
}
function options() {
  return {
    style: { height: '320px' },
    time: 6,
    zoom: 6,
    sources: { recording: { type: 'point-aggregate' as const, data } },
    series: {
      vibration: {
        data: {
          source: 'recording',
          domain: { range: [-1.2, 1.8], axis: true },
          instantaneous: { resolution: 1 / sampleRate },
        },
        chart: chart(),
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  };
}
defineExpose({
  exportCode: () =>
    vanillaCode(
      { ...options(), sources: { recording: { type: 'point-aggregate', data: expression('vibrationSamples()') } } },
      sampleCode,
      `timescope.fitTo(${JSON.stringify(selectedRange.value)}, { animation: false });`,
    ),
});
onMounted(() => {
  timescope = new Timescope({ ...options(), target: target.value! });
  view([0, 12]);
});
watch(envelope, () => timescope?.updateOptions({ series: { vibration: { chart: chart() } } }));
onBeforeUnmount(() => timescope?.dispose());
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button @click="view([0, 12])">Overview</button><button @click="view([3.5, 4.5])">Burst</button
      ><button @click="view([6.1, 6.15])">Impact</button><button @click="view([3.99, 4.01])">Individual samples</button
      ><label><input v-model="envelope" type="checkbox" /> Min / max envelope</label>
    </div>
    <div ref="target"></div>
    <p class="demo-note">
      49,152 samples · 4,096 Hz · A 1 ms impact at 6.125 s. Hide the envelope at Overview to see what an average loses.
    </p>
  </div>
</template>

<style src="./demo.css"></style>
