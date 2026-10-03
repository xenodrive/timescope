<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { chartPresets, createChartPresets, initialPreset } from './chart-presets.js';

const target = ref();
const selected = ref(initialPreset);
let demo;
onMounted(() => {
  demo = createChartPresets(target.value);
});
onBeforeUnmount(() => demo?.timescope.dispose());
</script>

<template>
  <div class="demo">
    <div class="demo-controls">
      <label>
        <code>chart</code>
        <select v-model="selected" @change="demo.selectPreset(selected)">
          <option v-for="chart in chartPresets" :key="chart" :value="chart">{{ chart }}</option>
        </select>
      </label>
    </div>
    <div ref="target" style="height: 240px"></div>
  </div>
</template>

<style src="../../examples/demo.css"></style>
