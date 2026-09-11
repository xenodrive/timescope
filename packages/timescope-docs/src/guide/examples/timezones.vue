---
title: Time Zones
---

<template>
  <!-- #region html -->
  <div>
    <p>Top to bottom: UTC, Asia/Tokyo, America/New_York.</p>
    <div id="example-timezones"></div>
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
    target: "#example-timezones",
    style: { height: "240px" },
    zoom: -5,
    tracks: {
      utc: { timeAxis: { timeZone: "utc" } },
      tokyo: { timeAxis: { timeZone: "Asia/Tokyo" } },
      newYork: { timeAxis: { timeZone: "America/New_York" } },
    },
  });
  // #endregion code

  onBeforeUnmount(() => timescope.dispose());
});
</script>
