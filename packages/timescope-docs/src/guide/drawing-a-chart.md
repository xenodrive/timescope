<script setup>
import GuideChart from '../../.vitepress/theme/components/GuideChart.vue';
import ExampleChartPresets from './examples/chart-presets.vue';
import ExampleValueScale from './examples/value-scale.vue';
import { basicChart, multipleSeries, multipleTracks, decimation } from './examples/charts.js';
</script>

# Drawing a Chart

Draw snapshot data with chart presets, arrange multiple Series, and choose how values are scaled. Each section shows a configuration for a particular result; use the ones your chart needs. [Core Concepts](/guide/concepts) explains how the parts fit together.

## Basic chart {#basic-chart}

A line chart needs a target, a DataSource, and a Series that draws it. Usually, you will give the target an explicit height to make the data easier to see:

```html
<div id="timescope" style="height: 240px"></div>
```

The examples below use this import and target. Each live chart runs the code shown alongside it:

```js
import { Timescope } from 'timescope';
const target = '#timescope';
```

<ClientOnly><GuideChart :create="basicChart" /></ClientOnly>

<<< ./examples/charts.js#basic-chart{js}

- **`sources`** names the data inputs. `samples` is how a Series refers to this array, not a field in each row.
- **`series`** names the Series. Each one chooses a source and a chart preset; without `chart`, it does not draw a Chart.
- **`fit`** sets the initial visible interval. Numeric times are seconds by default, so this example spans 60 seconds from the Unix epoch.

With `tracks` and `data.domain` omitted, the chart uses the implicit `default` Track and an independent, automatically scaled linear Domain. No value axis is shown unless requested. A larger height is a presentation choice: a compact chart can also fit in 36px with a `symmetric: true` Track.

[Basic Chart example](/examples/gallery#basic-chart) · [Edit in Playground](/examples/playground?preset=basic-chart)

## Choose a chart preset {#chart-presets}

Set `chart` on a Series to select its presentation. Choose a string below to redraw the same samples, starting with `bars:filled`. The data and value scale stay fixed so you can compare the presets:

<ClientOnly><ExampleChartPresets /></ClientOnly>

| To draw…                    | Use…              |
| --------------------------- | ----------------- |
| Straight connections        | `'lines'`         |
| Smooth connections          | `'curves'`        |
| Individual samples          | `'points'`        |
| Lines with sample markers   | `'linespoints'`   |
| Step changes                | `'steps'`         |
| Bars from the baseline      | `'bars'`          |
| A filled area under a curve | `'curves:filled'` |

The selector passes its chosen string to this function:

<<< ./examples/chart-presets.js#select-preset{js}

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

<ClientOnly><GuideChart :create="multipleSeries" /></ClientOnly>

<<< ./examples/charts.js#multiple-series{js}

The shared Domain scales to both Series. Without it, each Series auto-scales independently, even when they share a Track. Series can also share a DataSource; [Styling](/guide/advanced/styling#marks-and-links) shows how to select different fields from the same rows.

Explore a larger comparison in the [Multiple Series example](/examples/gallery#multiple-series) or [Playground](/examples/playground?preset=multiple-series).

## Arrange separate Tracks {#multiple-tracks}

Put signals with different units in separate drawing regions while keeping their time axes aligned. Select a Track with the Series' `track` field:

<ClientOnly><GuideChart :create="multipleTracks" height="400px" /></ClientOnly>

<<< ./examples/charts.js#multiple-tracks{js}

Tracks without an explicit `height` share the available height. This example gives its target `height: 400px` to leave room for both Tracks. All Tracks pan and zoom together; Domains determine value scales independently of that layout.

[More multi-Track examples](/examples/gallery#multiple-tracks) · [Explore in Playground](/examples/playground?preset=multiple-tracks)

## Choose a value scale {#log-scale}

Use a logarithmic Domain when values span several orders of magnitude. This configuration plots response times with a left value axis; the small bump near 44 seconds remains visible alongside the much larger initial values:

<ClientOnly><ExampleValueScale /></ClientOnly>

Choose **scale** to switch between logarithmic and linear scaling. The `curvespoints` preset shows the original samples alongside the smooth curve; the small bump is much easier to see on the logarithmic scale.

<<< ./examples/charts.js#log-scale{js}

Equal vertical distances now represent equal ratios. Logarithmic Domains draw positive values only; any specified bounds must also be positive. Leave `scale` unspecified for a linear scale.

Move the time cursor to inspect the response value, then choose a **`tooltip.round`** setting. Numbers `0`–`5` select decimal places: `round: 3` displays three decimal places, while `0` rounds to a whole number. `undefined` leaves the tooltip value unrounded. This changes the label, not the data or the scale. For axis labels and exponential notation, see [Number formatting](/guide/advanced/styling#number-formatting).

The controls update these settings independently (`scale` and `round` are Vue refs in this example):

<<< ./examples/value-scale.vue#value-scale-controls{js}

Bounds normally follow visible data. Use Domain `range` to set bounds and `expand` / `shrink` to control their adjustment; see [auto scaling](/guide/concepts#auto-scaling). Label formatting is independent of the scale: [Styling](/guide/advanced/styling#number-formatting) covers decimal and exponential labels.

Compare the [linear Curve example](/examples/gallery#curve) with the [Log Scale example](/examples/gallery#log-scale), or [try different scales in Playground](/examples/playground?preset=log-scale).

## Decimation

For a dense recording, use a `'point-aggregate'` source to summarize samples at the requested data resolution. This example contains **262,144 samples**: 64 seconds at 4096 Hz, combining a slow, 16-second wave with fine sawtooth detail. The overview shows a smooth trend; zoom in repeatedly around any part of the wave to reveal the jagged detail and individual sample points.

<ClientOnly><GuideChart :create="decimation" /></ClientOnly>

<<< ./examples/charts.js#decimation{js}

**The preset draws the average of each bucket, not a selection of the original samples.** When zoomed out, the circles in `linespoints` represent those averages too. Fine variations and brief peaks can disappear in the average; zooming in requests finer buckets until individual samples become visible.

The source also exposes minimum and maximum values, so you can preserve the signal's envelope with [custom Marks & Links](/guide/advanced/styling#show-an-aggregate-envelope). The [Decimation example](/examples/gallery#decimation) combines an envelope with the average line.

Use `'point-percentile'` for percentile summaries. Both summary source types accept snapshot points, not interval rows or range loaders. See [source types and output fields](/api/types#timescopesourceoptions) for the available summaries.

## Explore further

- [Styling](/guide/advanced/styling) — change the appearance and build your own Charts with Marks and Links.
- [Chunk Loading](/guide/advanced/chunk-loading) — load large histories at the visible range and resolution.
- [Live Streaming](/guide/advanced/live-streaming) — draw arriving samples and follow the latest time.
- [Gallery](/examples/gallery) — explore more combinations and open their configuration in Playground.
