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
  <!-- #region html -->
  <div id="example-dynamic-loader" style="height: 350px"></div>
  <!-- #endregion html -->
  <p class="demo-note">Pan and zoom to load terrain. Boxes show the ranges returned by the loader.</p>
</template>

<style src="./demo.css"></style>
