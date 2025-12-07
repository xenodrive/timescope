---
title: Multiple Tracks
---

<template>
<!-- #region html -->
<div id="example-multi-tracks"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const timescope = // ignore:
new Timescope({
  target: '#example-multi-tracks',
  style: { height: '360px' },
  time: 6,
  zoom: 5,
  sources: {
    temperature: [
      { time: 0, value: 12 },
      { time: 2, value: 15 },
      { time: 4, value: 18 },
      { time: 6, value: 17 },
      { time: 8, value: 20 },
      { time: 10, value: 22 },
      { time: 12, value: 19 },
    ],
    windSpeed: [
      { time: 0, value: 8 },
      { time: 2, value: 10 },
      { time: 4, value: 12 },
      { time: 6, value: 9 },
      { time: 8, value: 11 },
      { time: 10, value: 13 },
      { time: 12, value: 10 },
    ],
    rainfall: [
      { time: 0, value: 0 },
      { time: 2, value: 2.5 },
      { time: 4, value: 3.2 },
      { time: 6, value: 1.2 },
      { time: 8, value: 0.8 },
      { time: 10, value: 2.9 },
      { time: 12, value: 1.5 },
    ],
    stormRisk: [
      { time: 0, value: 10 },
      { time: 2, value: 15 },
      { time: 4, value: 25 },
      { time: 6, value: 18 },
      { time: 8, value: 30 },
      { time: 10, value: 28 },
      { time: 12, value: 22 },
    ],
  },
  series: {
    temperature: {
      data: { source: 'temperature', name: 'Temperature', unit: '℃', color: '#fb923c' },
      chart: 'linespoints:filled',
      track: 'conditions',
    },
    wind: {
      data: { source: 'windSpeed', name: 'Wind', unit: 'm/s', color: '#0ea5e9' },
      chart: 'lines',
      track: 'conditions',
    },
    rainfall: {
      data: { source: 'rainfall', name: 'Rain', unit: 'mm', color: '#22c55e' },
      chart: 'boxes:filled',
      track: 'precip',
    },
    stormRisk: {
      data: { source: 'stormRisk', name: 'Storm chance', digits: 0, unit: '%', color: '#a855f7' },
      chart: 'linespoints',
      track: 'precip',
    },
  },
  tracks: {
    conditions: {},
    precip: {
      timeAxis: true,
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());
});

</script>
