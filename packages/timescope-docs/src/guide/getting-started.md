<script setup lang="ts">
import ExampleSimple from './getting-started-demo.vue'
</script>

# Getting Started

Use Timescope as a time picker with just a target element. You can add time-series visualization whenever you need it.

Using a framework? Start with its [binding](/guide/advanced/frameworks/overview) to integrate Timescope with your application's state and lifecycle.

## Installation

```bash
npm install timescope
```

## Create your first Timescope

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

[Method reference](/api/classes#timescope-methods)

## Cleanup

When removing a Timescope from a running application, call `timescope.dispose()` to release it and its event listeners. Register this with your application's teardown or HMR hook. [Framework components](/guide/advanced/frameworks/overview#lifecycle) handle instance disposal automatically.

An instance that lives until the page closes needs no unload handler. Clean up application-owned timers, data producers, and external listeners separately when tearing down a view.

## Next steps

- Learn the [Core Concepts](/guide/concepts)
- Use snapshot data, chart presets, multiple Series, and decimation in [Drawing a Chart](/guide/drawing-a-chart)
- Choose an [Advanced](/guide/advanced/) topic for custom drawing, chunk loading, live streaming, or Node.js
- Explore [Examples](/examples/gallery)
- Look up signatures and options in the [API Reference](/api/)
