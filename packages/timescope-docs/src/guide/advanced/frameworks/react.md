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

Keep static options outside the component, as above. For options derived from props or state, use `useMemo` and pass a new complete object when they change. Set the host's dimensions and background with a CSS-object `style` prop or `className`.

To synchronize a selection, pair `selectionRange={selection}` with `onSelectionRangeChanged={setSelection}`. To follow the clock instead of a fixed time, call `setTime(null)`.

Use `onTimeChanging={setPreview}` to preview time during interaction without replacing the committed time state. `onReady={onReady}` tells you when the canvas is mounted and drawable.

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props, callbacks, and ref methods](/api/frameworks) · [Live Streaming](/guide/advanced/live-streaming)
