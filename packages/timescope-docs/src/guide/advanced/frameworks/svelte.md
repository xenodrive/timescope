---
title: Svelte
---

# Svelte

Install `timescope` for core helpers and types, and `@timescope/svelte` for the Svelte component.

```bash
npm install timescope @timescope/svelte
```

## Bind time and zoom

Use Svelte 5's `bind:` to synchronize time and zoom with `$state`:

```svelte
<script lang="ts">
  import { Timescope } from '@timescope/svelte';
  import { Decimal, defineTimescopeOptions } from 'timescope';

  let time = $state<Decimal | null>(Decimal(15));
  let zoom = $state(3);
  const options = defineTimescopeOptions({
    sources: {
      values: [
        { time: 0, value: 1 },
        { time: 15, value: 3 },
        { time: 30, value: 2 },
      ],
    },
    series: { values: { data: { source: 'values' }, chart: 'lines' } },
    tracks: { default: { timeAxis: { relative: true } } },
  });
</script>

<Timescope style="height: 240px" {options} bind:time bind:zoom />
<button type="button" onclick={() => time = Decimal(15)}>Center at 15</button>
<output>Time: {time?.toString() ?? 'live'} · Zoom: {zoom.toFixed(2)}</output>
```

## Initial fit

To fit the data without binding time and zoom:

```svelte
<Timescope {options} initialFit={{ range: [0, 30], padding: 24 }} />
```

## Options and events

If the options will change, declare them with `$state.raw` and assign a new complete configuration for each update. Set the host's height and background with the component's CSS-string `style` prop or `class`.

Use `bind:selectionRange` to synchronize a selection, just as the example binds time and zoom. Assign `time = null` to follow the clock.

Svelte events carry the changed value in `event.detail`. For example, `on:timechanging={event => preview = event.detail}` previews time during interaction. Use `on:ready={onReady}` when you need to know that the canvas is mounted and drawable.

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props, events, and ref methods](/api/frameworks) · [Data updates](/guide/advanced/data)
