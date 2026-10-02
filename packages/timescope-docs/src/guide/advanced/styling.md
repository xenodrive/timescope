---
title: Styling
---

# Styling

Style the host element with CSS and customize the drawing through chart options. The [Styling example](/examples/gallery#styling) combines a gradient background with custom Marks, Links, axes, cursor, and selection colors.

## Backgrounds and layout

The canvas is transparent, so a chart can overlay a gradient or an image on its target:

```html
<div id="chart" class="chart"></div>
```

```css
.chart {
  height: 320px;
  color: #1f2937;
  background: linear-gradient(120deg, #14b8a633, #8b5cf622, #f59e0b33);
  border-radius: 12px;
  overflow: hidden;
}
```

Use `background-image: url(...)` and `background-size: cover` for an image. Add `overflow: hidden` when using rounded corners so the chart stays inside the target's shape.

Set a definite target height for a chart. With [framework components](/guide/advanced/frameworks/overview), use the component's `style` or class prop. CSS backgrounds are not included in [PNG exports](/guide/advanced/backends#render-a-png-in-the-browser).

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

`fillOpacity` defaults to `1` and is clamped to `0`–`1`.

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

The `marks` and `links` arrays, each entry's `draw`, `using`, and `style`, and individual style fields can all be callbacks. `origin`, `scale`, and `fillPost` are fixed values, not callbacks. The selected `draw` determines the coordinate count and supported style fields; `size` has primitive-specific meaning.

[Entries and callback contexts](/api/types#chart-entries) · [Style fields](/api/types#chart-styles)

## Tooltip placement

Use `tooltip.side` to prefer labels on the left or right of a sample, defaulting to `'right'`. Timescope may adjust placement to fit the available space; the setting does not fix an exact label position. `tooltip.label` overrides the label text.

[Tooltip settings](/api/types#tooltip).

## Number formatting

Set `tooltip.round` on a Series or `axis.round` on a Domain to control number labels without changing source data. For example, `round: 2` displays a tooltip value of `12345.6789` as `12345.68`. The `'decimal'` shortcut gives the same two decimal places, including trailing zeros.

For large or small values, use `'e'` to display `1.23e4`, or `'pow10'` to display `1.23×10⁴`. In these formats, `digits` controls the mantissa: `{ label: 'e', digits: 3 }` produces `1.235e4`. Omit `digits` from the object to leave tooltip mantissas unrounded or let axis precision adjust automatically. For decimal formatting, negative digits round to tens, hundreds, and so on.

Without `round`, tooltips retain all digits and axis precision is automatic. An explicit coarse precision may leave fewer or no axis ticks; omit `digits` if that happens.

The object form infers `mode` from a string `label`, otherwise defaulting to `'decimal'`; an omitted `label` uses the mode. `digits` must be a safe integer and cannot be negative in `'pow10'` mode. Incompatible mode/label pairs are rejected.

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
