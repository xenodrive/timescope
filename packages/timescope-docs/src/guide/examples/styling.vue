---
title: Styling
---

<template>
<!-- #region html -->
<div id="example-styling"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const samples: { time: number; value: { value: number; min: number; max: number } }[] = [
  { time: -3, value: { value: 22, min: 20, max: 24 } },
  { time: -2, value: { value: 25, min: 23, max: 28 } },
  { time: -1, value: { value: 23, min: 21, max: 26 } },
  { time: 0, value: { value: 27, min: 25, max: 30 } },
  { time: 1, value: { value: 26, min: 24, max: 29 } },
  { time: 2, value: { value: 28, min: 26, max: 31 } },
  { time: 3, value: { value: 24, min: 22, max: 27 } },
];

const timescope = // ignore:
new Timescope({
  target: '#example-styling',
  style: {
    height: '280px',
    background: '#0f172a',
  },
  time: 0,
  zoom: 5,
  sources: {
    samples,
  },
  series: {
    temperature: {
      data: {
        source: 'samples',
        unit: '°C',
        value: {
          value: 'value.value',
          min: 'value.min',
          max: 'value.max',
        },
      },
      chart: {
        links: [
          {
            draw: 'area',
            using: ['min@time', 'max@time'],
            style: {
              fillColor: '#38bdf8',
              fillOpacity: 0.16,
            },
          },
          {
            draw: 'line',
            using: 'value',
            style: {
              lineWidth: 2,
              lineColor: '#60a5fa',
            },
          },
        ],
        marks: [
          {
            draw: 'circle',
            using: 'value',
            style: {
              size: 6,
              fillColor: '#38bdf8',
            },
          },
        ],
      },
      tooltip: true,
      track: 'main',
    },
  },
  tracks: {
    main: {
      timeAxis: {
        labels: {
          color: '#94a3b8',
          fontSize: '12px',
        },
        ticks: {
          color: '#334155',
        },
        timeFormat: ({ time }) =>
          new Date(time.mul(1000).number()).toLocaleTimeString(),
      },
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());
});

</script>
