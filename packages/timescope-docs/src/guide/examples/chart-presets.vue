---
title: Chart Presets
---

<template>
  <div ref="timescope-ref"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { Timescope, type TimescopeChartType } from 'timescope';

const $el = useTemplateRef('timescope-ref');
const chart = defineModel<TimescopeChartType>({ default: 'linespoints' });
const props = withDefaults(defineProps<{ color?: string }>(), { color: '#0d9488' });

onMounted(() => {
  if (!$el.value) return;
  const timescope = new Timescope({
    target: $el.value,
    style: { height: '240px' },
    time: 1.5,
    zoom: 6,
    sources: {
      samples: [
        { time: 0, value: 0.2 },
        { time: 1, value: 0.45 },
        { time: 2, value: 0.6 },
        { time: 3, value: 0.4 },
      ],
    },
    series: {
      temperature: {
        data: {
          source: 'samples',
          color: props.color,
        },
        chart: chart.value,
      },
    },
  });

  watch([chart, () => props.color], () => {
    timescope.updateOptions({
      series: {
        temperature: {
          data: { source: 'samples', color: props.color },
          chart: chart.value,
        },
      },
      tracks: { default: { timeAxis: { relative: true } } },
    });
  });

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
