---
title: Vue
---

# Vue

Install `timescope` for core helpers and types, and `@timescope/vue` for the Vue component and reactive `defineTimescopeOptions`.

```bash
npm install timescope @timescope/vue
```

## Component

Pass chart configuration through `options` and use `v-model` to synchronize time and zoom with Vue refs. The component handles mounting and disposal.

```vue
<script setup lang="ts">
import { Timescope, defineTimescopeOptions } from '@timescope/vue';
import { Decimal } from 'timescope';
import { ref } from 'vue';

const time = ref<Decimal | null>(Decimal(15));
const zoom = ref(3);
const options = defineTimescopeOptions({
  style: { height: '240px' },
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
  <Timescope v-model:time="time" v-model:zoom="zoom" :options="options" />
  <button type="button" @click="time = Decimal(15)">Center at 15</button>
  <output>Time: {{ time?.toString() ?? 'live' }} · Zoom: {{ zoom.toFixed(2) }}</output>
</template>
```

| Task                               | Vue syntax                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Set chart configuration and height | `:options="options"`; `options.style.height`                                              |
| Update configuration               | `options.style = { height: '320px' }` with `defineTimescopeOptions` from `@timescope/vue` |
| Bind a selection                   | `v-model:selection-range="selection"`; state type `[Decimal, Decimal] \| null`            |
| Follow the clock                   | `time.value = null`                                                                       |
| Run after the chart has a size     | `@ready="onReady"`                                                                        |

## Initial fit

For a chart-managed view, omit the time and zoom bindings:

```vue
<Timescope :options="options" :initial-fit="{ range: [0, 30], padding: 24 }" />
```

[Props, events, and ref methods](/api/frameworks) · [Options](/api/timescope-options) · [Data updates](/guide/advanced/data)
