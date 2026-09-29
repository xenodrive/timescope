---
title: Svelte
---

<script setup>
import ChartPreview from './chart-preview.vue';
</script>

# Svelte

Use Svelte 5 state and `bind:` to synchronize the view. The [shared binding guide](/guide/advanced/frameworks) covers configuration, initial views, and lifecycle rules.

## Install

```bash
npm install @timescope/svelte
```

## Chart and two-way bindings

<ChartPreview />

Dragging and scrolling update the bound state. Assigning to `time` from the button moves the chart in the other direction.

```svelte
<script lang="ts">
  import { Decimal, Timescope, type TimescopeOptions } from '@timescope/svelte';

  let time = $state<Decimal | null>(Decimal(15));
  let zoom = $state(3);
  const options = {
    style: { height: '240px' },
    sources: { values: [{ time: 0, value: 1 }, { time: 15, value: 3 }, { time: 30, value: 2 }] },
    series: { values: { data: { source: 'values', color: '#0d9488' }, chart: 'lines' } },
    tracks: { default: { timeAxis: { relative: true } } },
  } satisfies TimescopeOptions;
</script>

<Timescope {options} bind:time bind:zoom />
<button type="button" onclick={() => time = Decimal(15)}>Center at 15</button>
<output>Time: {time?.toString() ?? 'live'} · Zoom: {zoom.toFixed(2)}</output>
```

## Bindings and component events

| Purpose                | Svelte syntax                              |
| ---------------------- | ------------------------------------------ |
| Current time and zoom  | `bind:time`, `bind:zoom`                   |
| Current selection      | `bind:selectionRange`                      |
| Read intermediate time | `on:timechanging={event => ...}`           |
| Drawable lifecycle     | `on:ready={onReady}`, `on:mount={onMount}` |

The binding uses component events: read their value from **`event.detail`**. For example, `on:timechanging={event => preview = event.detail}` updates a separate intermediate readout. Use ordinary `onclick` for your own HTML buttons, as above.

To fit on creation, initialize the bound `time` and `zoom` to undefined and add `initialFit={[0, 30]}`. The fitted values flow back into the bindings.

## Replace reactive options

For settings that change, store options in `$state.raw` and assign a new complete configuration. Keep supplied DataSource instances stable:

```ts
let options = $state.raw<TimescopeOptions>({
  style: { height: '240px' },
  sources: { values: source },
  series: { values: { data: { source: 'values' }, chart: 'lines' } },
});

function resizeChart() {
  options = { ...options, style: { height: '320px' } };
}
```

Here `source` is a DataSource created for this chart. Replacing the object applies the new configuration; use [source methods](/guide/advanced/data) for data updates.

## Component instance

Use `bind:this` for imperative controls:

```svelte
<script lang="ts">
  import { Timescope, type TimescopeAPI } from '@timescope/svelte';
  let chart: TimescopeAPI | undefined;
</script>

<Timescope bind:this={chart} initialFit={[0, 30]} />
<button type="button" onclick={() => chart?.fitTo([0, 30])}>Fit range</button>
```

The instance exposes the [shared imperative methods](/guide/advanced/frameworks#lifecycle-and-imperative-controls).
