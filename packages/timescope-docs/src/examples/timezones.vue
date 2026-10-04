---
title: Time Zones
---

<template>
  <div class="demo">
    <!-- #region html -->
    <div style="display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 12px">
      <div style="display: grid; grid-template-rows: repeat(4, 80px); align-items: center; font-size: 12px">
        <span>UTC</span>
        <span>Local</span>
        <span>Asia/Tokyo</span>
        <span>America/New_York</span>
      </div>
      <div id="example-timezones" style="height: 320px"></div>
    </div>
    <!-- #endregion html -->
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createTimezonesDemo } from './timezones-demo.js';

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createTimezonesDemo('#example-timezones');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>
