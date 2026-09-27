<template>
  <div id="example-simple"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import { Timescope } from 'timescope';

onMounted(() => {
  const timescope = new Timescope({
    target: '#example-simple',
  });

  onBeforeUnmount(() => timescope.dispose());
});
</script>
