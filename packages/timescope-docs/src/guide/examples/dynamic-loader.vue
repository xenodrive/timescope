---
title: Dynamic Loader
---

<template>
<!-- #region html -->
<div id="example-loader"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope, Decimal } from 'timescope';

onMounted(() => { // ignore:

const timescope = // ignore:
new Timescope({
  target: '#example-loader',
  style: { height: '240px' },
  time: 0,
  zoom: 0,
  sources: {
    waveform: {
      loader: async (chunk) => {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()));

        const start = chunk.range[0] ?? Decimal(0);
        const end = chunk.range[1] ?? start.add(Decimal(60));
        const resolution = chunk.resolution;

        const rows: { time: Decimal; value: { value: number; min: number; max: number } }[] = [];
        for (let t = start; t.le(end); t = t.add(resolution)) {
          const x = t.number() / 8;
          const base = Math.sin(x);
          rows.push({
            time: t,
            value: {
              value: base * 0.8,
              min: (base - 0.2) * 0.8,
              max: (base + 0.2) * 0.8,
            },
          });
        }
        return rows;
      },
    },
  },
  series: {
    waveform: {
      data: {
        source: 'waveform',
        value: {
          value: 'value.value',
          min: 'value.min',
          max: 'value.max',
        },
        range: [0, 1],
      },
      chart: {
        links: [
          { draw: 'area', using: ['min', 'max'], style: { fillOpacity: 0.25 } },
          { draw: 'line', using: 'value', style: { lineWidth: 1.5 } },
        ],
      },
      track: 'main',
    },
  },
  tracks: {
    main: {
      symmetric: true,
    },
  },
});
// #endregion code

onBeforeUnmount(() => timescope?.dispose());

});
</script>
