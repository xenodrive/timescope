<script setup>
import PresetPreview from '../../.vitepress/theme/components/PresetPreview.vue';
</script>

# Drawing a Chart

Draw snapshot data with chart presets, arrange multiple Series, and choose how values are scaled. Each section shows a configuration for a particular result; use the ones your chart needs. [Core Concepts](/guide/concepts) explains how the parts fit together.

## Basic chart {#basic-chart}

A line chart needs a target with a definite height, a DataSource, and a Series that draws it:

```html
<div id="timescope" style="height: 240px"></div>
```

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

- **`sources`** names the data inputs. `samples` is how a Series refers to this array, not a field in each row.
- **`series`** names the Series. Each one chooses a source and a chart preset; without `chart`, it does not draw a Chart.
- **`fit`** sets the initial visible interval. Numeric times are seconds by default, so this example spans 60 seconds from the Unix epoch.

With `tracks` and `data.domain` omitted, the chart uses the implicit `default` Track and an independent, automatically scaled linear Domain. No value axis is shown unless requested.

[Basic Chart example](/examples/gallery#basic-chart) · [Edit in Playground](/examples/playground?preset=basic-chart)

## Choose a chart preset {#chart-presets}

Set `chart` on a Series to select its presentation:

| To draw…                    | Use…              |
| --------------------------- | ----------------- |
| Straight connections        | `'lines'`         |
| Smooth connections          | `'curves'`        |
| Individual samples          | `'points'`        |
| Lines with sample markers   | `'linespoints'`   |
| Step changes                | `'steps'`         |
| Bars from the baseline      | `'bars'`          |
| A filled area under a curve | `'curves:filled'` |

For example, change an existing Series to a smooth curve:

```ts
timescope.updateOptions({
  series: { signal: { chart: 'curves' } },
});
```

`updateOptions()` merges the change, retaining the Series' data and other settings. You can also put the preset directly in the constructor. Connections change the drawing, not the source samples or the [instantaneous value](/guide/concepts#instantaneous-value) shown at the cursor.

[All presets](/api/types#timescopecharttype) · [Curve example](/examples/gallery#curve) · [Custom Marks & Links](/guide/advanced/styling#marks-and-links)

## Use snapshot data {#snapshot-data}

A snapshot supplies the complete dataset, whether it comes from an array, a URL, or a callback. The basic chart uses an array. To load the same row format from JSON, replace its source input:

```ts
sources: {
  samples: { url: '/samples.json' },
}
```

For application-specific acquisition, use a callback with `chunked: false`:

```ts
sources: {
  samples: {
    chunked: false,
    loader: async () => {
      const response = await fetch('/samples.json');
      if (!response.ok) throw new Error(`Samples: ${response.status}`);
      return response.json();
    },
  },
}
```

Use [`decoder` or `mappings`](/api/types#timescopedataloaderoptions) if the response has a different structure. Snapshots remain loaded until invalidated; call `timescope.reload(['samples'])` when the input has changed. For a history too large to load at once, use [Chunk Loading](/guide/advanced/chunk-loading).

### Plot dates or elapsed time

Rows can use date strings as well as numeric times:

```ts
const samples = [
  { time: '2026-01-15T10:00:00Z', value: 18 },
  { time: '2026-01-15T11:00:00Z', value: 21 },
];
```

Date strings and `Date` inputs represent calendar instants. Numbers use the data's time units, seconds by default. Time strings are parsed as dates, not numeric strings; use a [`Decimal`](/api/classes#decimal) when a numeric timestamp needs more precision than a JavaScript number can retain.

For a recording whose times start at zero, display elapsed time on the Track:

```ts
tracks: { default: { timeAxis: { relative: true } } }
```

For calendar labels, use `timeAxis: { timeZone: 'utc' }` or an IANA zone such as `'Asia/Tokyo'`. [Time-axis styling](/guide/advanced/styling#time-axis-labels) covers custom labels.

## Overlay multiple Series {#multiple-series}

Use multiple Series on the same Track to compare signals. Give them the same named Domain when equal vertical positions should mean equal values:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 30],
  sources: {
    indoor: [
      { time: 0, value: 18 },
      { time: 15, value: 21 },
      { time: 30, value: 19 },
    ],
    outdoor: [
      { time: 0, value: 12 },
      { time: 15, value: 16 },
      { time: 30, value: 14 },
    ],
  },
  domains: { temperature: { axis: 'left', unit: '°C' } },
  series: {
    indoor: {
      data: { source: 'indoor', domain: 'temperature', color: '#0d9488' },
      chart: 'linespoints',
    },
    outdoor: {
      data: { source: 'outdoor', domain: 'temperature', color: '#d97706' },
      chart: 'linespoints',
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

The shared Domain scales to both Series. Without it, each Series auto-scales independently, even when they share a Track. Series can also share a DataSource; [Styling](/guide/advanced/styling#marks-and-links) shows how to select different fields from the same rows.

[Multiple Series example](/examples/gallery#multiple-series) · [Edit in Playground](/examples/playground?preset=multiple-series)

## Arrange separate Tracks {#multiple-tracks}

Put signals with different units in separate drawing regions while keeping their time axes aligned. Select a Track with the Series' `track` field:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 30],
  sources: {
    temperature: [
      { time: 0, value: 18 },
      { time: 15, value: 21 },
      { time: 30, value: 19 },
    ],
    latency: [
      { time: 0, value: 8 },
      { time: 15, value: 42 },
      { time: 30, value: 12 },
    ],
  },
  series: {
    temperature: {
      track: 'temperature',
      data: { source: 'temperature', domain: { axis: 'left', unit: '°C' } },
      chart: 'lines',
    },
    latency: {
      track: 'latency',
      data: { source: 'latency', domain: { axis: 'left', unit: 'ms' } },
      chart: 'curves',
    },
  },
  tracks: {
    temperature: { timeAxis: false },
    latency: { timeAxis: { relative: true } },
  },
});
```

Tracks without an explicit `height` share the available height. Give the target enough space for all Tracks, for example `height: 400px`. All Tracks pan and zoom together; Domains determine value scales independently of that layout.

[Multiple Tracks example](/examples/gallery#multiple-tracks) · [Edit in Playground](/examples/playground?preset=multiple-tracks)

## Choose a value scale {#log-scale}

Use a logarithmic Domain when values span several orders of magnitude. This complete configuration plots response times with a left value axis:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 60],
  sources: {
    response: Array.from({ length: 16 }, (_, index) => {
      const time = index * 4;
      const decay = 10 ** (4 - time / 12);
      const bump = 1 + 6 * Math.exp(-(((time - 44) / 2.8) ** 2));
      return { time, value: decay * bump };
    }),
  },
  series: {
    response: {
      data: { source: 'response', domain: { scale: 'log', axis: 'left', unit: 'ms' } },
      chart: 'curves',
    },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

Equal vertical distances now represent equal ratios. Logarithmic Domains draw positive values only; any specified bounds must also be positive. Leave `scale` unspecified for a linear scale.

Bounds normally follow visible data. Use Domain `range` to set bounds and `expand` / `shrink` to control their adjustment; see [auto scaling](/guide/concepts#auto-scaling). Label formatting is independent of the scale: [Styling](/guide/advanced/styling#number-formatting) covers decimal and exponential labels.

[Log Scale example](/examples/gallery#log-scale) · [Edit in Playground](/examples/playground?preset=log-scale)

## Decimation

For a dense recording, use a `'point-aggregate'` source to summarize samples at the requested data resolution. Zooming out shows coarser summaries; zooming in reveals finer detail without replacing the source:

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  fit: [0, 10],
  sources: {
    recording: {
      type: 'point-aggregate',
      data: Array.from({ length: 40_960 }, (_, index) => ({
        time: index / 4096,
        value: Math.sin(index / 64) + 0.2 * Math.sin(index / 3),
      })),
    },
  },
  series: {
    signal: { data: { source: 'recording' }, chart: 'lines' },
  },
  tracks: { default: { timeAxis: { relative: true } } },
});
```

The preset draws the average of each bucket. The source also exposes minimum and maximum values, so you can show the signal's envelope with [custom Marks & Links](/guide/advanced/styling#show-an-aggregate-envelope) instead of hiding peaks in the average. The [Decimation example](/examples/gallery#decimation) combines an envelope with the average line.

Use `'point-percentile'` for percentile summaries. Both summary source types accept snapshot points, not interval rows or range loaders. See [source types and output fields](/api/types#timescopesourceoptions) for the available summaries.

## Explore further

- [Styling](/guide/advanced/styling) — change the appearance and build your own Charts with Marks and Links.
- [Chunk Loading](/guide/advanced/chunk-loading) — load large histories at the visible range and resolution.
- [Live Streaming](/guide/advanced/live-streaming) — draw arriving samples and follow the latest time.
- [Gallery](/examples/gallery) — explore more combinations and open their configuration in Playground.
