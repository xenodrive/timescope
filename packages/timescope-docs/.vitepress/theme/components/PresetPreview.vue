<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Timescope } from 'timescope';
import { presets } from '../../../src/guide/playground/presets.js';
import { buildOptions } from '../../../src/guide/playground/options.js';

const props = defineProps({ preset: { type: String, required: true } });
const target = ref();
const state = presets.find((preset) => preset.id === props.preset).create();
let timescope;
onMounted(() => {
  timescope = new Timescope({ ...buildOptions(state), target: target.value });
});
onBeforeUnmount(() => timescope?.dispose());
</script>

<template>
  <div ref="target" :style="{ width: state.width, height: state.height, background: state.background }"></div>
</template>
