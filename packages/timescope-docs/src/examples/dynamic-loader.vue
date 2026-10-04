<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { mountTerrain } from './dynamic-terrain.js';
let cleanup;
onMounted(() => {
  cleanup = mountTerrain('#example-dynamic-loader');
});
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div class="demo">
    <!-- #region html -->
    <div>
      <label><input id="example-simulate-loading-delay" type="checkbox" checked /> Simulate loading delay</label>
    </div>
    <div id="example-dynamic-loader" style="height: 350px"></div>
    <!-- #endregion html -->
    <p class="demo-note">Pan and zoom to load generated data on demand.</p>
  </div>
</template>

<style src="./demo.css"></style>
