<script setup>
import PresetPreview from '../../.vitepress/theme/components/PresetPreview.vue';
</script>

# Drawing a Chart

With time navigation and the [Core Concepts](/guide/concepts) in place, add data and drawing to the Timescope from Getting Started.

Start with data already available in your application. Remote acquisition, chunk loading, and live updates are covered in [Loading and Updating Data](/guide/advanced/data).

## Basic Chart

Give the target element from Getting Started enough height for a Chart:

```html
<div id="timescope" style="height: 200px"></div>
```

Give each sample a `time` and a `value`, register the array in `sources`, and select its name with `series.signal.data.source`:

```ts
import { Timescope } from 'timescope';

const samples = [12, 24, 18, 42, 35, 48, 20, 32, 26].map((value, index) => ({
  time: index * 7.5,
  value,
}));

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 60],
  sources: { samples },
  series: {
    signal: {
      data: { source: 'samples', color: '#0d9488' },
      chart: 'lines',
    },
  },
});
```

<ClientOnly><PresetPreview preset="basic-chart" /></ClientOnly>

- **`sources`** registers DataSources. The key `samples` is how a Series refers to this array; it is not a field in each row.
- **`series`** registers Series. `signal` is the Series name, independent of the DataSource name.
- **`chart: 'lines'`** connects consecutive samples. Without a `chart`, a Series does not draw a Chart.
- **Target height** leaves room for the Chart. Without a definite target height, the canvas uses a `36px` fallback intended for a time axis.
- **`fit`** chooses the initial visible range. Numeric times are seconds by default, so this example spans 60 seconds from the Unix epoch.

With `tracks` and `data.domain` omitted, this uses the implicit `default` Track and an independent, automatically scaled linear Domain. No value axis is shown unless requested.

[Basic Chart example](/guide/examples/#basic-chart) · [Edit in Playground](/guide/examples/playground?preset=basic-chart)

## Curve

Use `chart: 'curves'` to join samples with a monotone cubic curve rather than straight segments. Replace the basic configuration with the following response-time example:

```ts
const response = Array.from({ length: 16 }, (_, index) => {
  const time = index * 4;
  const decay = 10 ** (4 - time / 12);
  const bump = 1 + 6 * Math.exp(-(((time - 44) / 2.8) ** 2));
  return { time, value: decay * bump };
});

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 60],
  sources: { response },
  series: {
    response: {
      data: {
        source: 'response',
        color: '#0d9488',
        domain: { axis: 'left', unit: 'ms' },
      },
      chart: 'curves',
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

<ClientOnly><PresetPreview preset="curve" /></ClientOnly>

The inline **Domain** enables a left value axis and adds `ms` to its labels and the Tooltip. Its bounds scale automatically. **`relative: true`** labels the time axis as elapsed time from zero rather than calendar time.

The curve changes only the connections, not the samples or the Series' [instantaneous value](/guide/concepts#instantaneous-value).

[Curve example](/guide/examples/#curve) · [Edit in Playground](/guide/examples/playground?preset=curve)

## Log Scale

The response values span several orders of magnitude. A linear scale makes the small bump near 44 seconds hard to see. On the instance created above, switch to a logarithmic scale and use powers of ten for axis and tooltip labels:

```ts
timescope.updateOptions({
  series: {
    response: {
      data: { domain: { scale: 'log', axis: { round: 'pow10' } } },
      tooltip: { round: 'pow10' },
    },
  },
});
```

<ClientOnly><PresetPreview preset="log-scale" /></ClientOnly>

`updateOptions()` merges the change, keeping the DataSource, curve, unit, and other value-axis settings. For an initially logarithmic Chart, put these settings in the constructor instead.

**Logarithmic Domains draw positive values only.** Any specified bounds must also be positive. Equal vertical distances now represent equal ratios rather than equal differences; time and the row values themselves are unchanged.

[Log Scale example](/guide/examples/#log-scale) · [Edit in Playground](/guide/examples/playground?preset=log-scale)

## Marks & Links {#ribbon-points}

A row can carry several named values at the same time. Use `values` instead of `value` to provide a central measurement and its lower and upper bounds:

```ts
const measurements = Array.from({ length: 121 }, (_, index) => {
  const time = index / 2;
  const value = 30 + 12 * Math.sin(time / 5);
  return { time, values: { value, min: value - 5, max: value + 5 } };
});
```

Compose the Chart from Marks and Links rather than using a string preset:

```ts
const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 60],
  sources: { measurements },
  series: {
    signal: {
      data: { source: 'measurements', color: '#0d9488' },
      chart: {
        links: [{ draw: 'area', using: ['min', 'max'] }, { draw: 'line' }],
        marks: [{ draw: 'circle', style: { size: 4, fillColor: '#0d9488' } }],
      },
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

<ClientOnly><PresetPreview preset="ribbon-points" /></ClientOnly>

- **Area Link**: `using: ['min', 'max']` selects the two boundaries of the ribbon. Both use the row's default `time` field. Without `using`, an area extends from `value` to the Track's `#zero` baseline instead.
- **Line Link**: the default selector is `value@time`, so it connects the central measurements.
- **Circle Mark**: the same default selector places a point at every sample. Its `fillColor` is explicit so the points are solid; the ribbon inherits the Series color at the default 25% alpha.

Links are drawn in array order, then Marks are drawn over them. Putting the area before the line keeps the central line visible. All these primitives use the same Series and Domain, so the automatic range includes the ribbon's `min` and `max`, not just the central values.

Other combinations work the same way: use `curve-area` and `curve` for a smooth ribbon, or use the [`linespoints` / `curvespoints` presets](/api/timescope-options#chart-presets) when you only need a line or curve with points.

[Marks & Links example](/guide/examples/#ribbon-points) · [Edit in Playground](/guide/examples/playground?preset=ribbon-points)

## Next steps

- Compare shared Domains and separate Tracks in [Multiple Charts](/guide/examples/#multiple-charts) and [Multiple Tracks](/guide/examples/#multiple-tracks).
- Open an example's **Options** popup for its configuration, or use [Playground](/guide/examples/playground) to edit it.
- Connect remote history, chunk loading, and live samples with [Loading and Updating Data](/guide/advanced/data).
- Look up all [Chart presets](/api/timescope-options#chart-presets), [Links](/api/timescope-options#links), [Marks](/api/timescope-options#marks), and [`using` selectors](/api/timescope-options#using-selectors).
