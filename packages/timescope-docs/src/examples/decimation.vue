<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { mountDecimation } from './decimation-demo.js';
let cleanup;
onMounted(() => {
  cleanup = mountDecimation('#example-decimation');
});
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div class="demo">
    <!-- #region html -->
    <div id="example-decimation" style="height: 320px"></div>
    <!-- #endregion html -->
    <p class="demo-note">Zoom in to explore 49,152 samples, from the min/max envelope to individual points.</p>
  </div>
</template>

<style src="./demo.css"></style>
