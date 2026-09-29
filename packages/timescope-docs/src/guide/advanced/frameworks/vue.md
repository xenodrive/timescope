---
title: Vue
---

<script setup>
import ChartPreview from './chart-preview.vue';
</script>

# Vue

Use Vue refs and `v-model` to keep the chart and application state synchronized. The [shared binding guide](/guide/advanced/frameworks) covers configuration, initial views, and lifecycle rules.

## Install

```bash
npm install @timescope/vue
```

## Chart and bound state

<ChartPreview />

The example below renders this line chart with a time/zoom readout. Dragging updates the refs; the button updates the same time ref to navigate from the parent.

```vue
<script setup lang="ts">
import { Timescope, defineTimescopeOptions } from '@timescope/vue';
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
  series: { values: { data: { source: 'values', color: '#0d9488' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});
</script>

<template>
  <Timescope v-model:time="time" v-model:zoom="zoom" :options="options" />
  <button type="button" @click="time = Decimal(15)">Center at 15</button>
  <output>Time: {{ time?.toString() ?? 'live' }} · Zoom: {{ zoom.toFixed(2) }}</output>
</template>
```

## Vue-specific bindings

| Purpose                         | Vue syntax                                   |
| ------------------------------- | -------------------------------------------- |
| Current time and zoom           | `v-model:time="time"`, `v-model:zoom="zoom"` |
| Current selection               | `v-model:selection-range="selection"`        |
| Read a drag's intermediate time | `@timechanging="value => ..."`               |
| Read animation position         | `@timeanimating="value => ..."`              |
| Drawable lifecycle              | `@ready="onReady"`, `@mount="onMount"`       |

Event handlers receive the value directly. To fit the initial data instead of supplying the current position, start `time` and `zoom` as undefined refs and add `:initial-fit="[0, 30]"`.

## Reactive configuration

Import `defineTimescopeOptions()` from **`@timescope/vue`**. It makes the configuration reactive and preserves supplied DataSource instances for use with Vue reactivity. Replacing the options or changing nested reactive settings updates the chart:

```ts
options.style = { height: '320px' };
```

Use [source update methods](/guide/advanced/data) for incoming data rather than rebuilding the options on every sample.

## Component refs

For a one-off command such as fitting a range, attach a template ref:

```vue
<script setup lang="ts">
import { Timescope } from '@timescope/vue';
import { useTemplateRef } from 'vue';

const chart = useTemplateRef('chart');
</script>

<template>
  <Timescope ref="chart" :initial-fit="[0, 30]" />
  <button type="button" @click="chart?.fitTo([0, 30])">Fit range</button>
</template>
```

The ref also exposes current and intermediate values, plus the [shared imperative methods](/guide/advanced/frameworks#lifecycle-and-imperative-controls).
