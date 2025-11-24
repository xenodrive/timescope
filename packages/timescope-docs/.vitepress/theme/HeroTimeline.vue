<template>
  <div ref="timescope" class="timescope-demo"></div>
</template>

<script setup lang="ts">
import { Timescope } from 'timescope';
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

const element = useTemplateRef('timescope');

onMounted(() => {
  const timescope = new Timescope({
    zoom: 3.5,
  });

  if (element.value) timescope.mount(element.value);

  onBeforeUnmount(() => timescope.dispose());
});

</script>

<style scoped>
.timescope-demo {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
}
</style>
