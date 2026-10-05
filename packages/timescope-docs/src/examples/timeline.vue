---
title: Timeline
---

<template>
  <div class="demo">
    <!-- #region html -->
    <div id="example-timeline" style="height: 48px"></div>
    <!-- #endregion html -->
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createTimelineDemo } from './timeline-demo.js';

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createTimelineDemo('#example-timeline');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>
