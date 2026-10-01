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

Leave `digits` unspecified for automatic value-axis decimal places, shared by all labels on the axis. Tooltips default to two decimal places, independently of the axis: an axis labeled `0.0`, `0.2`, `0.4` can show `0.24` in a tooltip.

Set domain `digits` for shared fixed decimal places. Override it with `axis: { digits: 2 }` on the domain or `tooltip: { digits: 3 }` on the series. Use tooltip `format` for a custom value display; its context includes the resolved tooltip/domain `digits`, falling back to `2` when neither is set.
