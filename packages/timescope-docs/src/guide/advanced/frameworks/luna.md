---
title: Luna
---

# Luna

Install `timescope` for core helpers and types, and `@timescope/luna` for the Luna component.

```bash
npm install timescope @timescope/luna @luna_ui/luna
```

## Component

Pass signal accessors for reactive props and child text, and use change callbacks to update Luna signals. The component handles mounting and disposal; callbacks receive values directly.

```tsx
import { createSignal } from '@luna_ui/luna';
import { Timescope } from '@timescope/luna';
import { Decimal, defineTimescopeOptions } from 'timescope';

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
      <Timescope options={options} time={time} onTimeChanged={setTime} zoom={zoom} onZoomChanged={setZoom} />
      <button type="button" onclick={() => setTime(Decimal(15))}>
        Center at 15
      </button>
      <output>{() => `Time: ${time()?.toString() ?? 'live'} · Zoom: ${zoom().toFixed(2)}`}</output>
    </>
  );
}
```

| Task                           | Luna syntax                                                               |
| ------------------------------ | ------------------------------------------------------------------------- |
| Bind time and zoom             | `time={time}`, `zoom={zoom}` with their change callbacks                  |
| Bind a selection               | `selectionRange={selection}` and `onSelectionRangeChanged={setSelection}` |
| Update configuration           | `options={() => ...}` returning a new complete options object             |
| Set chart height               | `options.style.height`                                                    |
| Follow the clock               | `setTime(null)`                                                           |
| Run after the chart has a size | `onReady={onReady}`                                                       |

## Initial fit

For a chart-managed view, omit the time and zoom props:

```tsx
<Timescope options={options} initialFit={{ range: [0, 30], padding: 24 }} />
```

[Props and callbacks](/api/frameworks) · [Options](/api/timescope-options) · [Data updates](/guide/advanced/data)
