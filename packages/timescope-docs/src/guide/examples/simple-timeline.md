<script setup>
import Example from './simple-timeline.vue';
</script>

# Simple Timeline

Select a time using a timeline, without supplying any data series.

## Try it

Drag horizontally and watch the time at the center cursor. Zoom to change how much time fits in the view.

<Example />

## Code

<!-- example-code -->

## How it works

- `target` identifies the container. Sources and charts are optional.
- With no explicit initial `time`, the timeline follows the live clock. Set a `Date` or an ISO date string to start at a fixed instant.
- The selected time is at the center. Increasing zoom narrows the visible time window.

## Next steps

[Connect an external input](./time-control) to use the selected time in your application, or [add a chart](./basic-chart). See the [Timescope API](/api/timescope) for navigation methods.
