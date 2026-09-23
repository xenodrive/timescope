<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Timescope } from 'timescope';
import { vanillaCode } from './vanilla';

const target = ref<HTMLElement>();
const labels = ref(true);
let timescope: Timescope | undefined;
const tasks = [
  { name: 'Receive', start: 0, end: 2.4, lane: 4, color: '#38bdf8' },
  { name: 'Decode', start: 1.8, end: 4.8, lane: 3, color: '#818cf8' },
  { name: 'Transform', start: 3.4, end: 7.5, lane: 2, color: '#c084fc' },
  { name: 'Render', start: 6.5, end: 9.6, lane: 1, color: '#2dd4bf' },
];
function chart() {
  return {
    marks: [
      {
        draw: 'bar' as const,
        using: ['lane@start', 'lane@end'] as [string, string],
        style: {
          size: 30,
          radius: 7,
          fillColor: ({ data }: { data: (typeof tasks)[number] }) => data.color,
          lineWidth: 0,
        },
      },
      ...(labels.value
        ? [
            {
              draw: 'text' as const,
              using: 'lane@middle',
              style: {
                size: 13,
                text: ({ data }: { data: (typeof tasks)[number] }) => data.name,
                textColor: '#0f172a',
              },
            },
          ]
        : []),
    ],
  };
}
function options() {
  return {
    style: { height: '300px' },
    time: 5,
    zoom: 6,
    sources: {
      tasks: tasks.map((task) => ({
        times: { start: task.start, middle: (task.start + task.end) / 2, end: task.end },
        values: { lane: task.lane },
        data: task,
      })),
    },
    series: { pipeline: { data: { source: 'tasks', domain: { range: [0, 5] } }, chart: chart(), tooltip: false } },
    tracks: { default: { timeAxis: { relative: true } } },
  };
}
defineExpose({ exportCode: () => vanillaCode(options(), '', 'timescope.fitTo([-0.5, 10.5], { animation: false });') });
onMounted(() => {
  timescope = new Timescope({ ...options(), target: target.value! });
  timescope.fitTo([-0.5, 10.5], { animation: false });
});
watch(labels, () => timescope?.updateOptions({ series: { pipeline: { chart: chart() } } }));
onBeforeUnmount(() => timescope?.dispose());
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <label><input v-model="labels" type="checkbox" /> Labels at the midpoint</label
      ><button @click="timescope?.fitTo([-0.5, 10.5], { animation: false })">Fit pipeline</button>
    </div>
    <div ref="target"></div>
    <div class="demo-config">bar: using: ['lane@start', 'lane@end'] · text: using: 'lane@middle'</div>
  </div>
</template>

<style src="./demo.css"></style>
