---
title: Compare on a Shared Scale
---

<template>
  <!-- #region html -->
  <div id="example-shared-domain"></div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore
  const timescope = new Timescope({
    target: '#example-shared-domain',
    style: { height: '240px' },
    time: 2,
    zoom: 6,
    sources: {
      indoors: [
        { time: 0, value: 20 },
        { time: 1, value: 21 },
        { time: 2, value: 22 },
        { time: 3, value: 21 },
        { time: 4, value: 20 },
      ],
      outdoors: [
        { time: 0, value: 10 },
        { time: 1, value: 12 },
        { time: 2, value: 15 },
        { time: 3, value: 13 },
        { time: 4, value: 11 },
      ],
    },
    domains: {
      temperature: { range: [0, 30], unit: '°C', axis: 'left' },
    },
    series: {
      indoors: {
        data: { source: 'indoors', name: 'Indoors', domain: 'temperature', color: '#ea580c' },
        chart: 'linespoints',
      },
      outdoors: {
        data: { source: 'outdoors', name: 'Outdoors', domain: 'temperature', color: '#0284c7' },
        chart: 'linespoints',
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  // #endregion code

  onBeforeUnmount(() => timescope.dispose());
});
</script>
