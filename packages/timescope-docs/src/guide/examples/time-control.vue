---
title: Synchronize a Time Control
---

<template>
  <!-- #region html -->
  <div id="example-time-control"></div>
  <label>
    Selected time (seconds)
    <input id="example-time-input" type="number" step="any" />
  </label>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

// #region code
import { Decimal, Timescope } from 'timescope';

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore
  const input = document.getElementById('example-time-input') as HTMLInputElement;
  const timescope = new Timescope({
    target: '#example-time-control',
    style: { height: '120px' },
    time: 30,
    zoom: 2,
    tracks: { default: { timeAxis: { relative: true } } },
  });

  // A subscription does not publish the initial value.
  input.value = timescope.time?.toString() ?? '';
  const unsubscribe = timescope.on('timechanged', ({ value }) => {
    input.value = value?.toString() ?? '';
  });

  function selectTime() {
    if (!input.value || !input.validity.valid) return;
    const value = Decimal(input.value);
    if (!timescope.time?.eq(value)) timescope.setTime(value, false);
  }
  input.addEventListener('change', selectTime);

  // Register cleanup with your application's teardown lifecycle.
  function cleanup() {
    input.removeEventListener('change', selectTime);
    unsubscribe();
    timescope.dispose();
  }
  // #endregion code
  onBeforeUnmount(cleanup);
});
</script>
