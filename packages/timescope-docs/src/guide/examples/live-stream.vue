<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { mountLiveSignal } from './live-signal.js';
let cleanup;
onMounted(() => {
  cleanup = mountLiveSignal('#example-live-stream');
});
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <!-- #region html -->
  <div class="demo">
    <div class="demo-controls">
      <button id="live-toggle">Start</button>
      <button id="live-follow">Follow live</button>
    </div>
    <div id="example-live-stream" style="height: 300px"></div>
  </div>
  <!-- #endregion html -->
</template>

<style src="./demo.css"></style>
