<script setup lang="ts">
import ExampleSimple from './getting-started-demo.vue'
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

<ExampleSimple />

## Time control

```TypeScript
timescope.time; // Decimal | null
```

```TypeScript
timescope.on('timechanged', (event) => {
  const time = event.value; // Decimal | null
});
```

```TypeScript
timescope.setTime(10);                      // number (seconds by default)
timescope.setTime('2024-01-15T10:00:00Z');  // ISO string
timescope.setTime(new Date());              // Date
timescope.setTime(null);                    // follow the live clock
```

## Next steps

- Learn the [Core Concepts](/guide/concepts)
- Explore [Examples](/guide/examples/)
- Dive into the [API Reference](/api/timescope)
