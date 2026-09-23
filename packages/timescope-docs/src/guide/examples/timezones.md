<script setup>
import Example from './timezones.vue';
</script>

# Time Zones

Display one shared time axis using different local-time labels.

## Try it

Move the timeline and compare the labels in UTC, Tokyo, and New York. All three tracks move together.

<Example />

## Code

<!-- example-code -->

## How it works

- Each Track configures its own `timeAxis.timeZone`.
- The selected instant is shared; a time zone changes its presentation, not the underlying timestamp.
- No sources are required for multiple time axes.

## Next steps

See [Multiple Tracks](./multiple-tracks) for data in stacked regions and [Tracks](/api/timescope-options#tracks) for axis options.
