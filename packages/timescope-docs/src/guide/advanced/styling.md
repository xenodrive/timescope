---
title: Styling
---

# Styling

Style the host element with CSS and customize the drawing through chart options. The [Styling example](/guide/examples/#styling) combines a gradient background with custom Marks, Links, axes, cursor, and selection colors.

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

Set a definite target height for a chart; without one, the height falls back to `36px`. With [framework components](/guide/advanced/frameworks), use the component's `style` or class prop. CSS backgrounds are not included in [PNG exports](/guide/advanced/backends#render-a-png-in-the-browser).

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

Leave label colors unspecified to follow the host. An explicit time-axis `labels.color` or value-axis `color` takes precedence. Set inheritance and CSS variables on the host; canvas color options should contain concrete colors, not `inherit` or unresolved `var(...)` expressions.

## Drawing colors

Set `series.data.color` for the default Mark and Link color. Use primitive `lineColor` and `fillColor` for overrides, and `fillOpacity` to adjust fill transparency. Translucent Marks show the background without showing Links through their interiors.

Use `cursor.color` for the cursor's strip fill, `cursor.borderColor` for its center line, and `selection.color` for the selected-range overlay. The cursor's default strip is transparent. Time-axis lines, ticks, and out-of-range areas default to translucent neutral gray, visible on both light and dark backgrounds. Axis and label overrides are listed in the [options reference](/api/timescope-options#time-axis); the [Styling example](/guide/examples/#styling) shows these settings together.

## Number formatting

Axes automatically choose decimal places shared by their labels. Tooltips show values without fixed rounding. Set `tooltip: { round: 2 }` on a series to keep tooltip values concise without changing the data or axis.

Use `axis: { round: 2 }` on a domain for two decimal places. The axis chooses ticks that match the displayed values; a precision too coarse for the range can leave fewer or no ticks.

Choose `round: 'e'` for `1.23e4` or `round: 'pow10'` for `1.23×10⁴`. String shortcuts use two mantissa decimal places. For automatic axis precision or unrounded tooltip mantissas, use `{ label: 'e' }` or `{ label: 'pow10' }` instead.

Customize the label by assembling the numeric parts:

```ts
round: {
  mode: 'pow10',
  digits: 3,
  label: ({ mantissa, base, exponent }) => `${mantissa} × ${base}^${exponent}`,
}
```

Use tooltip `format` when replacing the complete tooltip text, including its name and unit. See [Number Rounding](/api/timescope-options#number-rounding) for the options and callback parts.
