<script setup lang="ts">
import ExampleSimple from './getting-started-demo.vue'
</script>

# Getting Started

## Installation

```bash
npm install timescope
```

## Create a time navigator

```html
<div id="timescope"></div>
```

```ts
import { Timescope } from 'timescope';

const timescope = new Timescope({ target: '#timescope' });
```

<ExampleSimple />

## Accessing the selected time

Read the selected time directly, or subscribe to changes:

```ts
console.log(timescope.time); // Decimal | null

timescope.on('timechanged', ({ value }) => {
  console.log(value);
});
```

## View control

### Changing the initial view

Set an initial time and zoom, or fit a whole interval:

```ts
new Timescope({ target: '#timescope', time: 15, zoom: 3 });
```

```ts
new Timescope({ target: '#timescope', fit: [0, 30] });
```

### Programmatic control

Time inputs accept numbers (seconds by default), date strings, and `Date` objects. Use `null` to follow the wall clock.

```ts
timescope.setTime(15);
timescope.setTime('2026-01-15T10:00:00Z');
timescope.setTime(new Date());
timescope.setTime(null);
timescope.setZoom(2);
timescope.fitTo([0, 30]);
```

[Method reference](/api/timescope#navigation)

## Next steps

- Learn the [Core Concepts](/guide/concepts)
- Add data, lines, curves, and points with [Drawing a Chart](/guide/drawing-a-chart)
- Connect remote data and application controls with [Advanced guides](/guide/advanced/)
- Use a [framework binding](/guide/advanced/frameworks)
- Explore [Examples](/guide/examples/)
- Look up signatures and options in the [API Reference](/api/timescope)
