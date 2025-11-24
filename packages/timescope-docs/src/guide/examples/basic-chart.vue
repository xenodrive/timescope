---
title: Basic Chart
---

<template>
<!-- #region html -->
<div id="example-basic-chart"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const timescope = // ignore:
new Timescope({
  target: '#example-basic-chart',
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
      },
      chart: 'linespoints',
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());

});

</script>
