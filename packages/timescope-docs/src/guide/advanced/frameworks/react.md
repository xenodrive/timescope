---
title: React
---

# React

Install `timescope` for core helpers and types, and `@timescope/react` for the React component.

```bash
npm install timescope @timescope/react
```

## Component

Pair time and zoom props with change callbacks to keep React state synchronized with chart interactions. The component handles mounting and disposal; callbacks receive values directly.

```tsx
import { Timescope } from '@timescope/react';
import { Decimal, defineTimescopeOptions } from 'timescope';
import { useState } from 'react';

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

| Task                               | React syntax                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Set chart configuration and height | `options={options}`; `options.style.height`                                                    |
| Update configuration               | Pass a new complete options object; keep static options outside the component or use `useMemo` |
| Bind a selection                   | `selectionRange={selection}` and `onSelectionRangeChanged={setSelection}`                      |
| Follow the clock                   | `setTime(null)`                                                                                |
| Run after the chart has a size     | `onReady={onReady}`                                                                            |

## Initial fit

For a chart-managed view, omit the time and zoom props:

```tsx
<Timescope options={options} initialFit={{ range: [0, 30], padding: 24 }} />
```

[Props, callbacks, and ref methods](/api/frameworks) · [Options](/api/timescope-options) · [Data updates](/guide/advanced/data)
