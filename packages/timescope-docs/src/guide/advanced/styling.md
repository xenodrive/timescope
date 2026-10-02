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

Set a definite target height for a chart; without one, the height falls back to `36px`. With [framework components](/guide/advanced/frameworks/overview), use the component's `style` or class prop. CSS backgrounds are not included in [PNG exports](/guide/advanced/backends#render-a-png-in-the-browser).

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

Inherited fills use the Series color at 25% alpha. An explicit `fillColor` uses its own alpha; `fillOpacity` applies in either case. For filled path Marks, a transparent fill or `fillOpacity: 0` leaves a transparent interior rather than showing previously drawn Links. Text and icon Marks do not have this background-cutout behavior.

Use `fillPost: true` when you want the fill to replace the interior portion of the outline; the default keeps the complete outline over the fill. Pixels outside the Mark's path are unaffected.

Use `cursor.color` for the cursor's strip fill, `cursor.borderColor` for its center line, and `selection.color` for the selected-range overlay. The cursor's default strip is transparent. Time-axis lines, ticks, and out-of-range areas default to translucent neutral gray, visible on both light and dark backgrounds. Axis and label overrides are listed in the [options reference](/api/timescope-options#time-axis); the [Styling example](/examples/gallery#styling) shows these settings together.

## Number formatting

Set `tooltip.round` on a Series or `axis.round` on a Domain to control number labels without changing source data. For a tooltip value of `12345.6789`:

| `round`                     | Display    |
| --------------------------- | ---------- |
| `2` or `'decimal'`          | `12345.68` |
| `'e'`                       | `1.23e4`   |
| `'pow10'`                   | `1.23×10⁴` |
| `{ label: 'e', digits: 3 }` | `1.235e4`  |

String shortcuts use two decimal places, including trailing zeros. In exponential mode, `digits` applies to the mantissa. Use `{ label: 'e' }` or `{ label: 'pow10' }` without `digits` for unrounded tooltip mantissas or automatic axis precision. Negative decimal digits round to tens, hundreds, and so on.

Without `round`, tooltips retain all digits and axes choose shared decimal places automatically. With an explicit precision, axes select exactly representable ticks; a coarse precision may leave fewer or no ticks, including for constant-value domains. Leave axis precision automatic if that happens.

For a custom label, assemble the formatted mantissa and exponent:

```ts
round: {
  mode: 'pow10',
  digits: 3,
  label: ({ mantissa, base, exponent }) => `${mantissa} × ${base}^${exponent}`,
}
```

The callback also receives `value` and `roundedValue`: original and displayed values for tooltips, or the same finalized tick value for axes. Use tooltip `format` only when replacing the complete text, including its name and unit. [Round fields and callback types](/api/timescope-options#number-rounding).
