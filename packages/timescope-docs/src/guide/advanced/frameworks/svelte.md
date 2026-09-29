---
title: Svelte
---

# Svelte

Install and use `@timescope/svelte` instead of `timescope`. It provides the Svelte component and re-exports the core helpers and types, so a separate `timescope` installation is not needed.

```bash
npm install @timescope/svelte
```

## Component

Use Svelte 5's `bind:` to synchronize time and zoom with `$state`. The component handles mounting and disposal.

```svelte
<script lang="ts">
  import { Decimal, Timescope, defineTimescopeOptions } from '@timescope/svelte';

  let time = $state<Decimal | null>(Decimal(15));
  let zoom = $state(3);
  const options = defineTimescopeOptions({
    style: { height: '240px' },
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

<Timescope {options} bind:time bind:zoom />
<button type="button" onclick={() => time = Decimal(15)}>Center at 15</button>
<output>Time: {time?.toString() ?? 'live'} · Zoom: {zoom.toFixed(2)}</output>
```

| Task                               | Svelte syntax                                                  |
| ---------------------------------- | -------------------------------------------------------------- |
| Set chart configuration and height | `{options}`; `options.style.height`                            |
| Update configuration               | Store options in `$state.raw` and assign a new complete object |
| Bind a selection                   | `bind:selectionRange`; state type `[Decimal, Decimal] \| null` |
| Follow the clock                   | `time = null`                                                  |
| Run after the chart has a size     | `on:ready={onReady}`                                           |
| Read an intermediate time          | `on:timechanging={event => preview = event.detail}`            |

## Initial fit

For a chart-managed view, omit the time and zoom bindings:

```svelte
<Timescope {options} initialFit={{ range: [0, 30], padding: 24 }} />
```

[Props, events, and ref methods](/api/frameworks) · [Options](/api/timescope-options) · [Data updates](/guide/advanced/data)
