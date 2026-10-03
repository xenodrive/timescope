<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  create: { type: Function, required: true },
  height: { type: String, default: '240px' },
});
const target = ref();
let timescope;
onMounted(() => {
  timescope = props.create(target.value);
});
onBeforeUnmount(() => timescope?.dispose());
</script>

<template>
  <div ref="target" :style="{ height }"></div>
</template>
