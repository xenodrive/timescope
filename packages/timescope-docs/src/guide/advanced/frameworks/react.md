---
title: React
---

# React

Install `timescope` for core helpers and types, and `@timescope/react` for the React component.

```bash
npm install timescope @timescope/react
```

## Bind time and zoom

Pair time and zoom props with change callbacks to synchronize React state with chart interaction. Callbacks receive values directly:

```tsx
import { Timescope } from '@timescope/react';
import { Decimal, defineTimescopeOptions } from 'timescope';
import { useState } from 'react';

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

export default function Chart() {
  const [time, setTime] = useState<Decimal | null>(Decimal(15));
  const [zoom, setZoom] = useState(3);

  return (
    <>
      <Timescope
        style={{ height: '240px' }}
        options={options}
        time={time}
        onTimeChanged={setTime}
        zoom={zoom}
        onZoomChanged={setZoom}
      />
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

## Initial fit

To fit the data without binding time and zoom:

```tsx
<Timescope options={options} initialFit={{ range: [0, 30], padding: 24 }} />
```

## Options and events

| Task                            | React syntax                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Style the host element          | `style` with a CSS object, or `className`                                                                        |
| Update options                  | Pass a new complete object; keep static options outside the component, or memoize derived options with `useMemo` |
| Bind a selection                | `selectionRange={selection}` and `onSelectionRangeChanged={setSelection}`                                        |
| Follow the clock                | `setTime(null)`                                                                                                  |
| Handle readiness                | `onReady={onReady}`                                                                                              |
| Preview time during interaction | `onTimeChanging={setPreview}`                                                                                    |

[Shared component behavior](/guide/advanced/frameworks#configuration-and-state) · [Props, callbacks, and ref methods](/api/frameworks) · [Data updates](/guide/advanced/data)
