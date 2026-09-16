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

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore

  const timescope = new Timescope({
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

          const rows: {
            time: Decimal;
            values: { value: number; min: number; max: number };
          }[] = [];
          // Include one sample on each side as rendering context for linked charts.
          for (let t = start.sub(resolution); t.le(end.add(resolution)); t = t.add(resolution)) {
            const x = t.number() / 8;
            const base = Math.sin(x);
            rows.push({
              time: t,
              values: {
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
          domain: { range: [-1, 1] },
          instantaneous: { zoom: 5 },
        },
        chart: {
          links: [
            {
              draw: 'area',
              using: ['min', 'max'],
            },
            { draw: 'line', using: 'value', style: { lineWidth: 1.5 } },
          ],
        },
        track: 'main',
      },
    },
    tracks: {
      main: {
        symmetric: true,
        timeAxis: { relative: true },
      },
    },
  });
  // #endregion code

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
