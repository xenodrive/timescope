---
title: Decimation
---

<template>
  <!-- #region html -->
  <div id="example-decimation"></div>
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
    target: '#example-decimation',
    style: { height: '240px', background: '#fff' },
    time: '2021-04-10',
    zoom: -10,
    sources: {
      telemetry: {
        url: '/timescope/data/decimation.json',
        immediate: true,
        type: 'point-aggregate',
      },
    },
    series: {
      temperature: {
        data: {
          source: 'telemetry',
          domain: { range: [0, 120], unit: '°C', digits: 1 },
        },
        chart: {
          links: [
            { draw: 'line', using: 'value' },
            { draw: 'area', using: ['value#min', 'value#max'] },
          ],
        },
      },
    },
  });

  timescope.on('selectionrangechanged', (event) => {
    if (event.value) timescope.fitTo(event.value);
  });
  // #endregion code

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
