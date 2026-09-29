---
title: Solid
---

# Solid

Install `timescope` for core helpers and types, and `@timescope/solid` for the Solid component.

```bash
npm install timescope @timescope/solid
```

## Component

Read signal values in JSX and pass change callbacks to synchronize chart interactions with Solid signals. The component handles mounting and disposal; callbacks receive values directly.

```tsx
import { Timescope } from '@timescope/solid';
import { Decimal, defineTimescopeOptions } from 'timescope';
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
  series: { values: { data: { source: 'values' }, chart: 'lines' } },
  tracks: { default: { timeAxis: { relative: true } } },
});

export default function Chart() {
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

| Task                           | Solid syntax                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Bind time and zoom             | `time={time()}`, `zoom={zoom()}` with their change callbacks                       |
| Bind a selection               | `selectionRange={selection()}` and `onSelectionRangeChanged={setSelection}`        |
| Update configuration           | Return a new complete options object from `createMemo`; pass `options={options()}` |
| Follow the clock               | `setTime(null)`                                                                    |
| Run after the chart has a size | `onReady={onReady}`                                                                |
| Style the host element         | `class` and `style`; chart height goes in `options.style.height`                   |

## Initial fit

For a chart-managed view, omit the time and zoom props:

```tsx
<Timescope options={options} initialFit={{ range: [0, 30], padding: 24 }} />
```

[Props and callbacks](/api/frameworks) · [Options](/api/timescope-options) · [Data updates](/guide/advanced/data)
