<script setup>
import Example from './events.vue';
</script>

# Events

Observe when Timescope publishes time, zoom, and selection-range changes.

## Try it

Drag and zoom, then release the interaction. Compare the changing, changed, and animating rows as the view moves and settles. Select a range to inspect its two endpoints.

<Example />

## Code

<!-- example-code -->

## How it works

- Read the payload from `event.value`; range events supply endpoints rather than a single time.
- Use `timechanged` for committed changes, `timechanging` for interaction feedback, and `timeanimating` for animation values.
- Events can also originate from API calls. Guard bidirectional state synchronization against echoing the same value.
- Subscribing does not initialize application state. Read `timescope.time` for the initial selection. `on()` returns a function that removes the subscription.

## Next steps

[Synchronize a Time Control](./time-control) shows application state synchronization. See [Events](/api/timescope#events) for the full event contracts.
