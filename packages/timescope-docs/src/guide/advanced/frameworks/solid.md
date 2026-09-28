---
title: Solid
---

<script setup>
import ChartPreview from './chart-preview.vue';
</script>

# Solid

Pass signal values in JSX and use callbacks to update the signals. The [shared binding guide](/guide/advanced/frameworks) covers configuration, initial views, and lifecycle rules.

## Install

```bash
npm install @timescope/solid
```

## Chart and signal state

<ChartPreview />

Read `time()` and `zoom()` where the component needs their values. Chart interactions update the signals through callbacks; the button updates the same time signal.

```tsx
import { Timescope, defineTimescopeOptions, Decimal } from '@timescope/solid';
import { createSignal } from 'solid-js';

const options = defineTimescopeOptions({
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
});

function Chart() {
  const [time, setTime] = createSignal<Decimal | null>(Decimal(15));
  const [zoom, setZoom] = createSignal(3);

  return (
    <>
      <Timescope options={options} time={time()} onTimeChanged={setTime} zoom={zoom()} onZoomChanged={setZoom} />
      <button type="button" onClick={() => setTime(Decimal(15))}>
        Center at 15
      </button>
      <output>
        Time: {time()?.toString() ?? 'live'} · Zoom: {zoom().toFixed(2)}
      </output>
    </>
  );
}
```

## Read values in JSX

| Value prop                     | Change callback                          |
| ------------------------------ | ---------------------------------------- |
| `time={time()}`                | `onTimeChanged={setTime}`                |
| `zoom={zoom()}`                | `onZoomChanged={setZoom}`                |
| `selectionRange={selection()}` | `onSelectionRangeChanged={setSelection}` |

Pass **values**, such as `time={time()}`, rather than the accessor function. Keep reactive reads in JSX or another reactive context so later signal changes reach the chart.

Callbacks receive values directly. `onTimeChanging` and `onTimeAnimating` provide intermediate positions; `onReady` and `onMount` report drawable lifecycle events.

To fit initially, start the time and zoom signals as undefined and pass `initialFit={[0, 30]}`. Use the signals for subsequent navigation.

## Derived configuration

Use a memo for options derived from signals, returning a new configuration when a setting changes:

```tsx
const options = createMemo(() =>
  defineTimescopeOptions({
    style: { height: '240px' },
    sources: { values: source },
    series: { values: { data: { source: 'values', color: color() }, chart: 'lines' } },
  }),
);

return <Timescope options={options()} initialFit={[0, 30]} />;
```

Import `createMemo` from `solid-js`. Here `source` is a stable DataSource and `color` is a signal accessor. Pass the memo's value as `options={options()}`. Replace the options object to apply changes instead of mutating a plain nested field.

The Solid component also accepts `class` and `style` for its host element. Use `options.style` for the chart's own dimensions and background.
