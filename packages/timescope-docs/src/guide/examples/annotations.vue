<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope, type TimescopeChartMark } from 'timescope';
import { annotationData } from './annotation-data.js';
import sampleCode from './annotation-data.js?raw';
import { expression, vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const annotations = ref(true);
const labels = ref(true);
const selectedRange = ref<[number, number]>([0, 65]);
const recording = annotationData();
type EventData = (typeof recording.events)[number]['data'];
let timescope: Timescope | undefined;
const marks = computed(() => {
  const result: TimescopeChartMark<[{ data: EventData }]>[] = [];
  if (!annotations.value) return result;
  result.push(
    {
      draw: 'line',
      using: ['value', 'labelHeight'],
      style: { lineWidth: 1, lineDashArray: [3, 4], lineColor: ({ data }) => data.color },
    },
    {
      draw: 'circle',
      using: 'value',
      style: { size: 7, fillColor: '#ffffff', lineWidth: 2, lineColor: ({ data }) => data.color },
    },
    {
      draw: 'icon',
      using: 'labelHeight',
      style: {
        size: 18,
        icon: ({ data }) => data.symbol,
        iconFontFamily: 'sans-serif',
        iconColor: ({ data }) => data.color,
      },
    },
  );
  if (labels.value)
    result.push({
      draw: 'text',
      using: 'labelHeight',
      style: {
        size: 12,
        offset: [14, 0],
        textAlign: 'left',
        textBaseline: 'middle',
        text: ({ data }) => data.label,
        textColor: ({ data }) => data.color,
        textOutline: true,
        textOutlineColor: '#ffffff',
        textOutlineWidth: 3,
      },
    });
  return result;
});
const options = computed(() => ({
  style: { height: '340px' },
  sources: { signal: recording.samples, events: recording.events },
  domains: { latency: { range: [0, 110] as [number, number], unit: 'ms', axis: 'left' as const } },
  series: {
    signal: {
      data: { source: 'signal', name: 'Response time', domain: 'latency', color: '#64748b' },
      chart: {
        links: [
          {
            draw: 'area' as const,
            using: ['value', '#zero'] as [string, string],
            style: { fillColor: '#cbd5e1', fillOpacity: 0.25 },
          },
          { draw: 'line' as const, using: 'value', style: { lineWidth: 2 } },
        ],
      },
    },
    annotations: {
      data: { source: 'events', domain: 'latency', instantaneous: false as const },
      chart: { marks: marks.value },
      tooltip: false,
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
}));
function view(range: [number, number]) {
  selectedRange.value = range;
  timescope?.fitTo(range, { animation: false });
}
onMounted(() => {
  timescope = new Timescope({ ...options.value, target: target.value!, time: 32.5, zoom: 4 });
  view(selectedRange.value);
});
watch(marks, () => timescope?.updateOptions({ series: { annotations: { chart: { marks: marks.value } } } }));
onBeforeUnmount(() => timescope?.dispose());
defineExpose({
  exportCode: () =>
    vanillaCode(
      {
        ...options.value,
        time: 32.5,
        zoom: 4,
        sources: { signal: expression('recording.samples'), events: expression('recording.events') },
      },
      `${sampleCode}\nconst recording = annotationData();`,
      `timescope.fitTo(${JSON.stringify(selectedRange.value)}, { animation: false });`,
    ),
});
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <button @click="view([0, 65])">Overview</button><button @click="view([24, 42])">Latency spike</button
      ><button @click="view([42, 60])">Recovery</button>
      <label><input v-model="annotations" type="checkbox" /> Annotations</label>
      <label><input v-model="labels" type="checkbox" :disabled="!annotations" /> Labels</label>
    </div>
    <div ref="target"></div>
    <p class="demo-note">
      Events are a second source on the same Track and Domain. Each pin connects the event label to the signal's value
      at that time.
    </p>
  </div>
</template>

<style src="./demo.css"></style>
