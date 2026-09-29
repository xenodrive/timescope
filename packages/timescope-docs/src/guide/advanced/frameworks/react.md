---
title: React
---

<script setup>
import ChartPreview from './chart-preview.vue';
</script>

# React

Pair value props with callbacks to synchronize React state. The [shared binding guide](/guide/advanced/frameworks) covers configuration, initial views, and lifecycle rules.

## Install

```bash
npm install @timescope/react
```

## Chart and state callbacks

<ChartPreview />

The chart reports time and zoom to `useState`. The button changes the time from React; dragging and scrolling update the readout through the same state.

```tsx
import { Timescope, Decimal, type TimescopeOptions } from '@timescope/react';
import { useState } from 'react';

const options = {
  style: { height: '240px' },
  sources: {
    values: [
      { time: 0, value: 1 },
      { time: 15, value: 3 },
      { time: 30, value: 2 },
    ],
  },
  series: { values: { data: { source: 'values', color: '#0d9488' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
} satisfies TimescopeOptions;

function Chart() {
  const [time, setTime] = useState<Decimal | null>(Decimal(15));
  const [zoom, setZoom] = useState(3);

  return (
    <>
      <Timescope options={options} time={time} onTimeChanged={setTime} zoom={zoom} onZoomChanged={setZoom} />
      <button type="button" onClick={() => setTime(Decimal(15))}>
        Center at 15
      </button>
      <output>
        Time: {time?.toString() ?? 'live'} · Zoom: {zoom.toFixed(2)}
      </output>
    </>
  );
}
```

## Props and callbacks

| Value prop       | Change callback           |
| ---------------- | ------------------------- |
| `time`           | `onTimeChanged`           |
| `zoom`           | `onZoomChanged`           |
| `selectionRange` | `onSelectionRangeChanged` |

Callbacks receive values directly. Use `onTimeChanging` or `onTimeAnimating` for an intermediate-position readout, and `onReady` or `onMount` for drawable lifecycle notifications.

To fit a range on creation, start both state values as undefined and pass `initialFit={[0, 30]}`. The resulting time and zoom arrive through the change callbacks.

## Stable options across renders

Keep a static options object outside the component, as above. If it depends on props or state, use `useMemo` and create a new object when those settings change:

```tsx
const options = useMemo<TimescopeOptions>(
  () => ({
    style: { height: '240px' },
    sources: { values: source },
    series: { values: { data: { source: 'values', color }, chart: 'lines' } },
  }),
  [source, color],
);
```

Import `useMemo` from `react`. Here `source` is a stable DataSource and `color` is the desired series color. Mutating a nested field of an unchanged options object does not trigger a configuration update.

## Imperative ref

The binding exports `TimescopeAPI` for a component ref:

```tsx
import { Timescope, type TimescopeAPI } from '@timescope/react';
import { useRef } from 'react';

function ChartControls() {
  const chart = useRef<TimescopeAPI>(null);
  return (
    <>
      <Timescope ref={chart} initialFit={[0, 30]} />
      <button type="button" onClick={() => chart.current?.fitTo([0, 30])}>
        Fit range
      </button>
    </>
  );
}
```

See the [shared imperative methods](/guide/advanced/frameworks#lifecycle-and-imperative-controls) for commands available on this ref.
