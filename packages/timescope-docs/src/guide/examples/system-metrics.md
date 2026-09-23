<script setup>
import Example from './system-metrics.vue';
</script>

# System Metrics

Combine CPU, memory, network, and disk measurements in a four-track dashboard. The data is generated once for demonstration.

## Try it

Pan and zoom to compare changes at the same time across all four regions.

<Example />

## Code

<!-- example-code -->

## How it works

- Each source feeds one series and one Track. All tracks share time navigation.
- Each chart combines a filled area, a line, and circular marks.
- Only the bottom Track shows time labels, reducing repeated labels.
- `timeRange` constrains navigation to the generated 600-second interval. The example is a snapshot, not a live monitoring connection.

## Next steps

See [Multiple Tracks](./multiple-tracks) for layout, [Realtime Data](./realtime-data) for live updates, and [Tracks](/api/timescope-options#tracks) for configuration.
