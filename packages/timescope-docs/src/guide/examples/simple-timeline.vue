---
title: Simple Timeline
---

<template>
<!-- #region html -->
<div id="example-simple"></div>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Timescope } from 'timescope';

onMounted(() => { // ignore:

const timescope = // ignore:
new Timescope({
  target: '#example-simple',
});
// #endregion code

onBeforeUnmount(() => timescope.dispose());
});

</script>
