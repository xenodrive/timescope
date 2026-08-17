---
title: Realtime Data
---

<template>
  <!-- #region html -->
  <div id="example-realtime-data"></div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

// #region code
import { createDataSource, Timescope } from "timescope";

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore
  const sampleInterval = 0.25;
  const initialSampleCount = 80;
  const valueAt = (index: number) =>
    50 + Math.sin(index / 8) * 18 + Math.sin(index / 2.5) * 4;
  const source = createDataSource({
    data: Array.from({ length: initialSampleCount }, (_, index) => ({
      time: index * sampleInterval,
      value: valueAt(index),
    })),
  });

  let nextIndex = initialSampleCount;
  const timescope = new Timescope({
    target: "#example-realtime-data",
    style: { height: "240px" },
    time: null,
    zoom: 5,
    sources: { realtime: source },
    series: {
      realtime: {
        data: {
          source: "realtime",
          domain: { range: [20, 80] },
        },
        chart: {
          links: [{ draw: "line", using: "value", style: { lineWidth: 2 } }],
        },
      },
    },
  });

  const timer = setInterval(() => {
    const index = nextIndex++;
    const time = index * sampleInterval;
    void source.append({ time, value: valueAt(index) });
    timescope.setPlaybackTime(time);
  }, sampleInterval * 1000);

  // #endregion code

  onBeforeUnmount(() => {
    clearInterval(timer);
    timescope.dispose();
  });
});
</script>
