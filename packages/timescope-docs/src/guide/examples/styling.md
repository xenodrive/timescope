<script setup>
import Example from './styling.vue';
</script>

# Styling

Style a temperature chart with a dark background, a shaded range, and custom time-axis labels.

## Try it

Move the samples past the cursor to inspect values, and compare the point markers, central line, and translucent range band.

<Example />

## Code

<!-- example-code -->

## How it works

- Top-level `style` controls the container height and background.
- Marks and links have separate styles for fill, stroke, opacity, and size.
- Named `min` and `max` fields define the band; `value` defines the line and points.
- `timeAxis.labels` and `timeAxis.ticks` style the axis independently of the chart. The value Domain supplies the °C unit.

## Next steps

Try colors interactively in [Chart Presets](./chart-presets) or compose layers in [Marks & Links](./marks-and-links). See [Tracks](/api/timescope-options#tracks) for axis options.
