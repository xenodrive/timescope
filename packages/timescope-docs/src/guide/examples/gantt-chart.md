<script setup>
import Example from './gantt-chart.vue';
</script>

# Gantt Chart

Draw task durations and labels using named time fields and vertical lanes within a single Track.

## Try it

Pan across the project schedule and zoom into overlapping tasks. Compare each bar's endpoints with the day labels.

<Example />

## Code

<!-- example-code -->

## How it works

- The decoder converts task days into seconds and supplies `start`, `middle`, and `end` time fields.
- `lane@start` and `lane@end` define each horizontal bar. `lane@middle` positions its label.
- The original task is retained in `data`, allowing styling callbacks to read its phase and title.
- Lanes are value coordinates within one Track, not separate Tracks. The time formatter converts seconds back to day labels.

## Next steps

See [Marks & Links](./marks-and-links) for field selectors and [Sources](/api/timescope-options#sources) for decoders.
