---
title: Styling
---

<script setup>
import GuideChart from '../../../.vitepress/theme/components/GuideChart.vue';
import { marksAndLinks } from '../examples/charts.js';
import ExampleDecimation from '../../examples/decimation.vue';
import ExampleStyling from '../../examples/styling.vue';
import ExampleValueScale from '../examples/value-scale.vue';
</script>

# Styling

Make a Chart your own: compose Marks and Links beyond the [presets](/guide/drawing-a-chart#chart-presets), vary the drawing with data, and match your application's theme. Style the host element with CSS and customize the drawing through chart options. The [Styling example](/examples/gallery#styling) combines these techniques.

## Compose Marks and Links {#marks-and-links}

To show a measurement and its lower and upper bounds, combine an area Link, a line Link, and circle Marks. Each primitive selects its own values from the same rows:

```html
<div id="chart" style="height: 240px"></div>
```

```ts
import { Timescope } from 'timescope';
const target = '#chart';
```

<ClientOnly><GuideChart :create="marksAndLinks" /></ClientOnly>

<<< ../examples/charts.js#marks-and-links{js}

- **Area Link:** `using: ['min', 'max']` selects the ribbon's bounds. Without `using`, an area extends from `value` to the Track's `#zero` baseline.
- **Line Link:** the default selector, `value@time`, connects the central measurements.
- **Circle Mark:** the same default selector places a point at each sample. An explicit `fillColor` makes the points solid; the ribbon inherits the Series color at 25% alpha.

Links are drawn in array order, then Marks are drawn over them. Putting the area before the line keeps the central line visible. All these primitives use the same Series and Domain, so auto scaling includes the ribbon's bounds as well as its central values.

Use `curve-area` and `curve` for a smooth ribbon. To draw a different named value, set `using: 'temperature'`; to choose a named time too, use a selector such as `'temperature@start'`. The [coordinate model](/guide/concepts#using-selectors) explains how selectors relate to rows, Track edges, and the shared baseline.

[Marks & Links example](/examples/gallery#ribbon-points) · [Edit in Playground](/examples/playground?preset=ribbon-points) · [Marks](/api/types#timescopechartmark) · [Links](/api/types#timescopechartlink)

### Show an aggregate envelope

For a [decimated recording](/guide/drawing-a-chart#decimation), a `'point-aggregate'` source exposes summaries as suffixed value fields. In this recording, the envelope preserves the bursts and a brief impact even when the average stays near zero. Zoom in to reveal individual sample markers:

<ClientOnly><ExampleDecimation /></ClientOnly>

The example's `chart` configuration selects minimum and maximum values for the area and the average for the line. Its Mark callback shows circles only at sample-level resolution (`sampleRate` is 4096 Hz):

<<< ../../examples/decimation-demo.js#envelope-chart{js}

This keeps peaks visible when an average alone would hide them. For a `'point-percentile'` source, select a percentile with a field such as `value#p95`. [Decimation example](/examples/gallery#decimation)

## Backgrounds and layout

The canvas is transparent, so a chart can overlay a gradient or an image on its target. This example combines a gradient with custom point shapes, lines, axes, cursor, and selection colors:

<ClientOnly><ExampleStyling /></ClientOnly>

Its host element supplies the background and rounded corners:

<<< ../../examples/styling.vue#html{html}

::: details Chart configuration used in this example
The drawing options below are taken directly from the running example. `target` is the host element above.

<<< ../../examples/styling-demo.js#example{js}
:::

Use `background-image: url(...)` and `background-size: cover` for an image. Add `overflow: hidden` when using rounded corners so the chart stays inside the target's shape.

Usually, set an explicit target height to give the chart more room; compact charts can also use a small height with a symmetric Track. With [framework components](/guide/advanced/frameworks/overview), use the component's `style` or class prop. CSS backgrounds are not part of the canvas pixels; [Running on Node.js](./running-on-node#set-the-output-appearance) covers appearance outside a browser layout.

## Dark and light themes

Leave time-axis and value-axis label colors unspecified to use the host's CSS `color`. Define a shared text-color variable and change it with your page's theme class:

```css
:root {
  --chart-text-color: #1f2937;
}

.dark {
  --chart-text-color: #e5e7eb;
}

.chart {
  color: var(--chart-text-color);
}
```

Toggle the theme class on a shared ancestor, such as the page root:

```ts
document.documentElement.classList.toggle('dark', darkModeEnabled);
```

Labels follow the changed CSS color without recreating the chart. In Node.js, set label colors explicitly when needed; the default is black.

Leave label colors unspecified to follow the host. An explicit time-axis `labels.color` or value-axis `color` takes precedence.

> [!IMPORTANT]
> Set inheritance and CSS variables on the host; canvas color options should contain concrete colors, not `inherit` or unresolved `var(...)` expressions.

## Drawing colors

Set `series.data.color` for the default Mark and Link color. Use primitive `lineColor` and `fillColor` for overrides, and `fillOpacity` to adjust fill transparency. Translucent Marks show the background without showing Links through their interiors.

Inherited fills use the Series color at 25% alpha. An explicit `fillColor` uses its own alpha; `fillOpacity` applies in either case. Filled path Marks keep Links hidden behind their interiors, even with a transparent fill. Text and icon Marks leave underlying Links visible.

Use `fillPost: true` when you want the fill to cover the inner edge of the outline; the default keeps the complete outline visible.

Use `cursor.color` for the cursor's strip fill, `cursor.borderColor` for its center line, and `selection.color` for the selected-range overlay. The cursor's default strip is transparent. Time-axis lines, ticks, and out-of-range areas default to translucent neutral gray, visible on both light and dark backgrounds. Axis and label overrides are listed in the [options reference](/api/types#timescopetimeaxisoptions); the [Styling example](/examples/gallery#styling) shows these settings together.

## Data-driven styles

Chart entries and their style fields can use callbacks instead of fixed values. A Mark callback receives the row's named `times`, named `values`, metadata `data`, and display `resolution`; a Link callback receives `resolution` only. Resolution is time units per pixel, `2 ** (-zoom)`, and row field and metadata types are inferred from the source.

```ts
chart: {
  marks: [{
    draw: 'circle',
    style: {
      size: ({ values }) => values.value?.gt(10) ? 8 : 4,
    },
  }],
}
```

You can also choose whole Marks and Links based on resolution, for example to show individual sample markers only when zoomed in. The selected `draw` determines the available coordinates and style fields.

[Entries and callback contexts](/api/types#chart-entries) · [Style fields](/api/types#chart-styles)

## Tooltip placement

Use `tooltip.side` to prefer labels on the left or right of a sample, defaulting to `'right'`. Timescope may adjust placement to fit the available space; the setting does not fix an exact label position. `tooltip.label` overrides the label text.

[Tooltip settings](/api/types#tooltip).

## Number formatting

Use the selectors below to compare number formats on the same response-time data as [Drawing a Chart](/guide/drawing-a-chart#log-scale), using a logarithmic scale. **`axis.round`** and **`tooltip.round`** are independent: try `undefined`, `0`–`5`, `'e'`, or `'pow10'`, or choose an object such as `{ label: 'e', digits: 3 }` or `{ label: 'pow10', digits: 1 }` to set exponential precision explicitly. Move the time cursor to inspect the Tooltip and compare its formatting with the axis labels.

<ClientOnly><ExampleValueScale formatting /></ClientOnly>

Set `tooltip.round` on a Series or `axis.round` on a Domain to control number labels without changing source data. For example, `round: 2` displays a tooltip value of `12345.6789` as `12345.68`. The `'decimal'` shortcut gives the same two decimal places, including trailing zeros.

For large or small values, use `'e'` to display `1.23e4`, or `'pow10'` to display `1.23×10⁴`. In these formats, `digits` controls the mantissa: `{ label: 'e', digits: 3 }` produces `1.235e4`. Omit `digits` from the object to leave tooltip mantissas unrounded or let axis precision adjust automatically. For decimal formatting, negative digits round to tens, hundreds, and so on.

Without `round`, tooltips retain all digits and axis precision is automatic. An explicit coarse precision may leave fewer or no axis ticks; omit `digits` if that happens.

Selecting `undefined` restores those defaults. The axis selector updates the Domain's axis while retaining its left-side placement (`axisRound` is a Vue ref):

<<< ../examples/value-scale.vue#axis-format-control{js}

For a custom label, assemble the formatted mantissa and exponent:

```ts
round: {
  mode: 'pow10',
  digits: 3,
  label: ({ mantissa, base, exponent }) => `${mantissa} × ${base}^${exponent}`,
}
```

The callback also receives `value` and `roundedValue`: original and displayed values for tooltips, or the same finalized tick value for axes. Use tooltip `format` only when replacing the complete text, including its name and unit. [Round fields and callback types](/api/types#timescoperound).

## Time-axis labels

Use a Track's `timeAxis` options to format time labels. `relative: true` displays time relative to zero. `timeUnit` selects the numeric unit (`'s'` by default), and `timeZone` selects `'local'`, `'utc'`, or an IANA zone for absolute labels and tick boundaries.

Supply `timeFormat` as a callback to replace a whole label. Its context includes the tick `time`, numeric `unit`, calendar `level`, fractional `digits`, and optional `stride`. Return `undefined` to use default formatting for that tick.

Alternatively, provide a `TimeFormatLabeler` object with callbacks for individual calendar units. Their components use the axis's `timeZone`; `week` is the weekday, with Sunday `0`. The [Timezones example](/examples/gallery#timezones) compares time units and zones.

[Time formatting types](/api/types#time-formatting)

## Fonts

Use `font` for the global text style and local font settings for individual labels or text Marks. Object properties inherit, so you can set a global family and override only the size or weight where needed:

```ts
const timescope = new Timescope({
  target: '#chart',
  fonts: [{ family: 'Chart Labels', source: 'url(/fonts/chart-labels.woff2)' }],
  font: { family: 'Chart Labels, sans-serif', weight: 'bold' },
  tracks: {
    default: { timeAxis: { labels: { font: { size: 16, weight: 'normal' } } } },
  },
});
```

Time-axis labels use normal 16px Chart Labels; other text uses bold Chart Labels at its default size. For an installed system font, setting `font.family` is enough.

`font` selects the drawing style; `fonts` loads additional browser font data and is set at creation. If `fonts` is omitted, Timescope loads accessible document `@font-face` rules. Use `fonts: []` to skip additional loading. In framework components, pass `fonts` as a creation-only prop and the style through `options.font`.

Prefer font objects when combining global and local settings. A string such as `'bold 14px "MS Gothic"'` is a complete declaration, not a family name. Icon fonts use their local settings.

[Font styles](/api/types#timescopefontstyle) · [Font loading options](/api/types#timescopeoptionsinitial)
