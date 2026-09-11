---
title: Log Scale
---

<template>
  <!-- #region html -->
  <div id="timescope-example-log-scale">
    <button>Toggle</button>
  </div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

// #region code
import { Timescope } from "timescope";

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore

  const timescope = new Timescope({
    target: "#timescope-example-log-scale",
    style: { height: "220px" },
    time: 2,
    zoom: 6,
    sources: {
      samples: [
        { time: 0, value: 1 },
        { time: 1, value: 10 },
        { time: 2, value: 100 },
        { time: 3, value: 1_000 },
        { time: 4, value: 10_000 },
      ],
    },
    series: {
      growth: {
        data: {
          source: "samples",
          domain: { scale: "log", range: [undefined, undefined], axis: true },
          color: "#f59e0b",
        },
        chart: "curvespoints",
        track: "main",
      },
    },
    tracks: {
      main: {
        timeAxis: {
          relative: true,
        },
      },
    },
  });

  const button = document.querySelector("#timescope-example-log-scale button");

  let logscale = true;
  button?.addEventListener("click", () => {
    logscale = !logscale;
    timescope.updateOptions({
      series: {
        growth: {
          data: {
            domain: {
              scale: logscale ? "log" : "linear",
              range: [undefined, undefined],
            },
          },
        },
      },
    });
  });
  // #endregion code

  onBeforeUnmount(() => timescope?.dispose());
});
</script>

<style scoped>
/* #region style */
#timescope-example-log-scale {
  position: relative;

  button {
    position: absolute;
    right: 0.125rem;
    top: 0.125rem;
    background: #eee;
    padding: 0 0.5rem;
    border-radius: 0.25rem;
  }
}
/* #endregion style */
</style>
