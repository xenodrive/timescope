<script setup lang="ts">
import ExampleSimple from './getting-started-demo.vue'
</script>

# Getting Started

## Installation

```bash
npm install timescope
```

::: tip Using a coding agent?
Install the Timescope skill for your coding agent:

```bash
npx skills add xenodrive/timescope
```

See the [skill documentation](https://github.com/xenodrive/timescope/blob/main/skills/timescope/SKILL.md) for details.
:::

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

## Next steps

- Learn the [Core Concepts](/guide/concepts)
- Use a [Framework Binding](/guide/advanced/frameworks/overview)
- Explore [Advanced topics](/guide/advanced/)
- Explore [Examples](/examples/gallery)
- Look up signatures and options in the [API Reference](/api/)
