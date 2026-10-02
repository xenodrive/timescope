---
title: Vue
---

# Vue

Install `timescope` for core helpers and types, and `@timescope/vue` for the component and reactive options helper:

```bash
npm install timescope @timescope/vue
```

## Bind time and zoom

Use `v-model` to synchronize time and zoom with Vue refs. Import `defineTimescopeOptions` from `@timescope/vue`, not `timescope`, to make the options reactive:

```vue
<script setup lang="ts">
import { Timescope, defineTimescopeOptions } from '@timescope/vue';
import { Decimal } from 'timescope';
import { ref } from 'vue';

const time = ref<Decimal | null>(Decimal(15));
const zoom = ref(3);
const options = defineTimescopeOptions({
  sources: {
    values: [
      { time: 0, value: 1 },
      { time: 15, value: 3 },
      { time: 30, value: 2 },
    ],
  },
  series: { values: { data: { source: 'values' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});
</script>

<template>
  <Timescope style="height: 240px" v-model:time="time" v-model:zoom="zoom" :options="options" />
  <button type="button" @click="time = Decimal(15)">Center at 15</button>
  <output>Time: {{ time?.toString() ?? 'live' }} · Zoom: {{ zoom.toFixed(2) }}</output>
</template>
```

## Initial fit

To fit the data without binding time and zoom:

```vue
<Timescope :options="options" :initial-fit="{ range: [0, 30], padding: 24 }" />
```

## Options and events

The reactive options helper lets you update settings directly. For example, `options.cursor = false` hides the cursor; nested changes are observed too. Use `style` or `class` on the component to set its height and background.

Bind a selection with `v-model:selection-range="selection"`, just as you bind time and zoom. To follow the clock, set `time.value = null`.

Vue event handlers receive the changed value directly. Use `@timechanging="value => preview = value"` to preview time during interaction, and `@ready="onReady"` when you need to know that the canvas is mounted and drawable.

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props, events, and ref methods](/api/frameworks) · [Live Streaming](/guide/advanced/live-streaming)
