---
title: Events
---

<template>
<!-- #region html -->
<div id="example-intermediate-values" :class="props.class"></div>
<table>
  <tbody>
    <tr>
      <th>timechanged</th><td><span id="timechanged" /></td>
      <th>zoomchanged</th><td><span id="zoomchanged" /></td>
    </tr>
    <tr>
      <th>timechanging</th><td><span id="timechanging" /></td>
      <th>zoomchanging</th><td><span id="zoomchanging" /></td>
    </tr>
    <tr>
      <th>timeanimating</th><td><span id="timeanimating" /></td>
      <th>zoomanimating</th><td><span id="zoomanimating" /></td>
    </tr>

  </tbody>
</table>
<!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
const props = defineProps<{
  class?: any;
}>();

// #region code
import { Timescope, type Decimal } from 'timescope';

onMounted(() => { // ignore:

function setValueOn(id: string, value: string | number | Decimal | null) {
  const elm = document.getElementById(id);
  if (elm) elm.innerText = value?.toString() ?? 'null';
}

const timescope = new Timescope({
  target: '#example-intermediate-values',
});

timescope.on('timechanged', (e) => setValueOn('timechanged', e.value));
timescope.on('timechanging', (e) => setValueOn('timechanging', e.value));
timescope.on('timeanimating', (e) => setValueOn('timeanimating', e.value));
timescope.on('zoomchanged', (e) => setValueOn('zoomchanged', e.value));
timescope.on('zoomchanging', (e) => setValueOn('zoomchanging', e.value));
timescope.on('zoomanimating', (e) => setValueOn('zoomanimating', e.value));

// #endregion code
setValueOn('timechanged', 'null');
setValueOn('timechanging', 'null');
setValueOn('timeanimating', 'null');
setValueOn('zoomchanged', '0');
setValueOn('zoomchanging', '0');
setValueOn('zoomanimating', '0');

onBeforeUnmount(() => timescope?.dispose());
});

</script>

<style scoped>
#timechanged, #timechanging, #timeanimating {
  display: block;
  width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#zoomchanged, #zoomchanging, #zoomanimating {
  display: block;
  width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
