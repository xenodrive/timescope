---
title: Events
---

<template>
  <div class="demo">
    <!-- #region html -->
    <div id="example-intermediate-values" :class="props.class"></div>
    <table>
      <tbody>
        <tr>
          <th>timechanged</th>
          <td><span id="timechanged" /></td>
          <th>zoomchanged</th>
          <td><span id="zoomchanged" /></td>
        </tr>
        <tr>
          <th>timechanging</th>
          <td><span id="timechanging" /></td>
          <th>zoomchanging</th>
          <td><span id="zoomchanging" /></td>
        </tr>
        <tr>
          <th>timeanimating</th>
          <td><span id="timeanimating" /></td>
          <th>zoomanimating</th>
          <td><span id="zoomanimating" /></td>
        </tr>
        <tr>
          <th>selectionrangechanging</th>
          <td><span id="selectionrangechanging" /></td>
          <th>selectionrangechanged</th>
          <td><span id="selectionrangechanged" /></td>
        </tr>
      </tbody>
    </table>
    <!-- #endregion html -->
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createEventsDemo } from './events-demo.js';
const props = defineProps<{
  class?: any;
}>();

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = createEventsDemo('#example-intermediate-values');
});
onBeforeUnmount(() => cleanup?.());
</script>

<style src="./demo.css"></style>

<style scoped>
#timechanged,
#timechanging,
#timeanimating,
#selectionrangechanging,
#selectionrangechanged {
  display: block;
  width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#zoomchanged,
#zoomchanging,
#zoomanimating {
  display: block;
  width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#selectionrangechanging,
#selectionrangechanged {
  height: 3rem;
}
</style>
