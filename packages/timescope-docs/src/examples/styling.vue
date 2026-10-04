---
title: Styling
---

<template>
  <div class="demo">
    <!-- #region html -->
    <div
      id="example-styling"
      style="
        height: 320px;
        color: var(--chart-text-color, inherit);
        background: linear-gradient(120deg, #14b8a633, #8b5cf622 55%, #f59e0b33);
        border-radius: 12px;
        overflow: hidden;
      "></div>
    <!-- #endregion html -->
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createStylingDemo } from './styling-demo.js';

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createStylingDemo('#example-styling');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>
