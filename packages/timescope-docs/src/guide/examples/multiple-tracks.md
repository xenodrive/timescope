<script setup>
import Example from './multiple-tracks.vue';
</script>

# Multiple Tracks

Stack two drawing regions, each containing two measurements with different units.

## Try it

Drag either region: both share the same time navigation. Compare the left and right value axes in each region.

<Example />

## Code

<!-- example-code -->

## How it works

- `series.*.track` places each series in `conditions` or `precip`.
- Series on the same Track are overlaid. Tracks determine layout, not value scales.
- Each series defines its own Domain with a unit and an axis side. Temperature and wind use independent scales even though they overlap.
- To compare equal-unit measurements numerically, reference one shared Domain instead.

## Next steps

[Compare on a Shared Scale](./shared-domain) demonstrates that distinction. See [Tracks](/api/timescope-options#tracks) and [Domains](/api/timescope-options#domains).
