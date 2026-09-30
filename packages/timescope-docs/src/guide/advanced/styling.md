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
}
```

Use `background-image: url(...)` and `background-size: cover` for an image. Filled path Marks clear their interiors before painting, and time-axis labels clear a narrow outline; those cleared regions reveal the CSS background, not a fixed canvas background color.

Generated canvases follow the target's definite CSS height, with a `36px` fallback for auto-height targets. [Framework components](/guide/advanced/frameworks) forward their host `style` and class props to the target. CSS backgrounds are not included in [PNG exports](/guide/advanced/backends#render-a-png-in-the-browser).

## Dark and light themes

Time-axis and value-axis labels default to the host's inherited CSS `color`. For VitePress, the text-color variable changes with the site theme:

```css
.chart {
  color: var(--vp-c-text-1);
}
```

The browser backend resolves the CSS color and sends it to the renderer, including Workers. Changes to `class` or `style` on the canvas or its ancestors, viewport resizing, and system dark/light preference changes refresh the color without recreating the chart. In Node.js there is no DOM color to inherit; unspecified labels use black.

Leave label colors unspecified to follow the host. An explicit time-axis `labels.color` or value-axis `color` takes precedence. Set inheritance and CSS variables on the host; canvas color options should contain concrete colors, not `inherit` or unresolved `var(...)` expressions.

## Drawing colors

`series.data.color` supplies the default Mark and Link color. Primitive `lineColor` and `fillColor` override it; `fillOpacity` multiplies the resolved fill alpha. Mark erasure is independent of fill alpha, so translucent Marks show the background without revealing previously drawn Links inside their paths.

The time cursor clears a narrow strip before drawing its center line; its default transparent edges reveal the background. Use `cursor.color` for the strip fill, `cursor.borderColor` for the center line, and `selection.color` for the selected-range overlay. Time-axis lines, ticks, and out-of-range areas default to translucent neutral gray, visible on both light and dark backgrounds. Axis and label overrides are listed in the [options reference](/api/timescope-options#time-axis); the [Styling example](/guide/examples/#styling) shows these settings together.
