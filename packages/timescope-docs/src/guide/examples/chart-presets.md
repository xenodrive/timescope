---
title: Chart Presets
titleTemplate: Timescope Examples
---
<script setup>
import Example from '@/guide/examples/chart-presets.vue';
import { ref } from 'vue';

const chart = ref('linespoints');
</script>

# Chart Presets

## Example

<select v-model="chart" style="padding: 0 0.5rem; border-radius: 4px;">
  <option>lines</option>
  <option>lines:filled</option>
  <option>curves</option>
  <option>curves:filled</option>
  <option>steps-start</option>
  <option>steps-start:filled</option>
  <option>steps</option>
  <option>steps:filled</option>
  <option>steps-end</option>
  <option>steps-end:filled</option>
  <option>points</option>
  <option>linespoints</option>
  <option>linespoints:filled</option>
  <option>curvespoints</option>
  <option>curvespoints:filled</option>
  <option>stepspoints-start</option>
  <option>stepspoints-start:filled</option>
  <option>stepspoints</option>
  <option>stepspoints:filled</option>
  <option>stepspoints-end</option>
  <option>stepspoints-end:filled</option>
  <option>impulses</option>
  <option>impulsespoints</option>
  <option>boxes</option>
  <option>boxes:filled</option>
</select>

<Example v-model="chart" />

## Code
```TypeScript-vue{8}
new Timescope({
     :
  series: {
    temperature: {
      data: {
        source: 'samples',
      },
      chart: '{{ chart }}',
    },
  },
     :
})
```

## Presets

| Chart preset | Marks | Links |
| --- | --- | --- |
| `lines` | – | `line` |
| `lines:filled` | – | `area`, `line` |
| `curves` | – | `curve` |
| `curves:filled` | – | `curve-area`, `curve` |
| `steps-start` | – | `step-start` |
| `steps-start:filled` | – | `step-area-start`, `step-start` |
| `steps` | – | `step` |
| `steps:filled` | – | `step-area`, `step` |
| `steps-end` | – | `step-end` |
| `steps-end:filled` | – | `step-area-end`, `step-end` |
| `points` | `circle` | – |
| `linespoints` | `circle` | `line` |
| `linespoints:filled` | `circle` | `area`, `line` |
| `curvespoints` | `circle` | `curve` |
| `curvespoints:filled` | `circle` | `curve-area`, `curve` |
| `stepspoints-start` | `circle` | `step-start` |
| `stepspoints-start:filled` | `circle` | `step-area-start`, `step-start` |
| `stepspoints` | `circle` | `step` |
| `stepspoints:filled` | `circle` | `step-area`, `step` |
| `stepspoints-end` | `circle` | `step-end` |
| `stepspoints-end:filled` | `circle` | `step-area-end`, `step-end` |
| `impulses` | `line` (using `value`, `zero`) | – |
| `impulsespoints` | `line` (using `value`, `zero`), `circle` | – |
| `boxes` | `box` (using `value`, `zero`; fill `transparent`) | – |
| `boxes:filled` | `box` (using `value`, `zero`) | – |
