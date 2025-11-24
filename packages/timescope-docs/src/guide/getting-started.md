<script setup lang="ts">
import ExampleSimple from '@/guide/examples/simple-timeline.vue'
</script>

# Getting Started

## Installation

```bash
npm install timescope
```

## Create a basic Timescope

```html
<div id="timescope"></div>
```

```TypeScript
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope'
});
```

This creates a basic Timescope instance:

<ExampleSimple />

## Time control

The `timescope.time` property returns a `Decimal` value representing the current cursor position. `Decimal` provides arbitrary-precision arithmetic.

Polling:
```TypeScript
// Poll the current value
const time = timescope.time; // Decimal | null
console.log('Current time (s):', time?.number()); // Convert to a native number
```

Event-based:

```TypeScript
// Subscribe to changes
timescope.on('timechanged', (event) => {
  const time = event.value;
  console.log('Current time (s):', time?.number());
});
```

Set time through the API:

```TypeScript
timescope.setTime(10);                     // number
timescope.setTime('2024-01-15T10:00:00Z'); // ISO string with timezone
timescope.setTime(new Date());             // Date instance
timescope.setTime(null);                   // Follow the live clock
```

## Next steps

- Learn the [Core Concepts](/guide/concepts)
- Explore [Examples](/guide/examples/)
- Dive into the [API Reference](/api/timescope)
