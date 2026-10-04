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
  <div class="demo">
    <!-- #region html -->
    <div>
      <button id="live-toggle">Start</button>
      <button id="live-follow">Follow live</button>
    </div>
    <div id="example-live-stream" style="height: 300px"></div>
    <!-- #endregion html -->
  </div>
</template>

<style src="./demo.css"></style>
