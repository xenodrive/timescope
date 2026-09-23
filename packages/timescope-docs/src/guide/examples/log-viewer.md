<script setup>
import Example from './log-viewer.vue';
</script>

# Log Viewer

Show discrete events by severity alongside a summary of event density. This demo generates sample logs locally.

## Try it

Zoom into a busy interval to distinguish individual events, then compare their distribution with the lower density chart.

<Example />

## Code

<!-- example-code -->

## How it works

- Each severity has its own source and a fixed vertical value, drawn with marks rather than connecting lines.
- The log series use matching fixed domain bounds to align severity rows.
- Density is calculated in 10-second windows and displayed on a separate Track with step links.
- Tooltip formatting displays relative seconds instead of calendar timestamps.

## Next steps

See [Marks & Links](./marks-and-links), [Multiple Tracks](./multiple-tracks), and [Source options](/api/timescope-options#sources).
