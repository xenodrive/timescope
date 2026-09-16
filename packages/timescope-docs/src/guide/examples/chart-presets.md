<script setup>
import Example from '@/guide/examples/chart-presets.vue';
import ChartColorInput from '../../../.vitepress/theme/components/ChartColorInput.vue';
import { ref } from 'vue';

const chart = ref('linespoints');
const color = ref('#0d9488');
</script>

# Chart Presets

## Example

<div class="chart-controls">
<div class="control-panel">
<div class="control-grid">
<label class="control-field">Chart preset
<select v-model="chart">
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
  <option>bars</option>
  <option>bars:filled</option>
</select>
</label>
<div class="control-field">color
<ChartColorInput v-model="color" label="Series color" />
</div>
</div>
<p class="control-hint">Choose a color with the picker. Filled presets derive a softer fill from this color; points hide the lines behind them.</p>
</div>
</div>

<Example v-model="chart" :color="color.trim() || '#0d9488'" />

## Code

```TypeScript
import { Timescope, type TimescopeChartType } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  time: 0.5,
  zoom: 6,
  sources: {
    samples: [
      { time: 0, value: 1 },
      { time: 1, value: 2 },
    ],
  },
  series: {
    temperature: {
      data: { source: 'samples', color: '#0d9488' },
      chart: 'linespoints',
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});

function setChart(chart: TimescopeChartType, color: string) {
  timescope.updateOptions({
    series: {
      temperature: {
        data: { source: 'samples', color },
        chart,
      },
    },
  });
}
```

## Presets

| Chart preset               | Marks                                              | Links                           |
| -------------------------- | -------------------------------------------------- | ------------------------------- |
| `lines`                    | –                                                  | `line`                          |
| `lines:filled`             | –                                                  | `area`, `line`                  |
| `curves`                   | –                                                  | `curve`                         |
| `curves:filled`            | –                                                  | `curve-area`, `curve`           |
| `steps-start`              | –                                                  | `step-start`                    |
| `steps-start:filled`       | –                                                  | `step-area-start`, `step-start` |
| `steps`                    | –                                                  | `step`                          |
| `steps:filled`             | –                                                  | `step-area`, `step`             |
| `steps-end`                | –                                                  | `step-end`                      |
| `steps-end:filled`         | –                                                  | `step-area-end`, `step-end`     |
| `points`                   | `circle`                                           | –                               |
| `linespoints`              | `circle`                                           | `line`                          |
| `linespoints:filled`       | `circle`                                           | `area`, `line`                  |
| `curvespoints`             | `circle`                                           | `curve`                         |
| `curvespoints:filled`      | `circle`                                           | `curve-area`, `curve`           |
| `stepspoints-start`        | `circle`                                           | `step-start`                    |
| `stepspoints-start:filled` | `circle`                                           | `step-area-start`, `step-start` |
| `stepspoints`              | `circle`                                           | `step`                          |
| `stepspoints:filled`       | `circle`                                           | `step-area`, `step`             |
| `stepspoints-end`          | `circle`                                           | `step-end`                      |
| `stepspoints-end:filled`   | `circle`                                           | `step-area-end`, `step-end`     |
| `impulses`                 | `line` (using `value`, `#zero`)                    | –                               |
| `impulsespoints`           | `line` (using `value`, `#zero`), `circle`          | –                               |
| `bars`                     | `bar` (using `value`, `#zero`; fill `transparent`) | –                               |
| `bars:filled`              | `bar` (using `value`, `#zero`)                     | –                               |

<style scoped>
@import './chart-controls.css';
</style>
