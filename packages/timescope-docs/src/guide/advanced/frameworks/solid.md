---
title: Solid
---

# Solid

Install `timescope` for core helpers and types, and `@timescope/solid` for the Solid component.

```bash
npm install timescope @timescope/solid
```

## Bind time and zoom

Read signal values in JSX and pass change callbacks to synchronize Solid signals with chart interaction. Callbacks receive values directly:

```tsx
import { Timescope } from '@timescope/solid';
import { Decimal, defineTimescopeOptions } from 'timescope';
import { createSignal } from 'solid-js';

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
  const [time, setTime] = createSignal<Decimal | null>(Decimal(15));
  const [zoom, setZoom] = createSignal(3);

  return (
    <>
      <Timescope
        style={{ height: '240px' }}
        options={options}
        time={time()}
        onTimeChanged={setTime}
        zoom={zoom()}
        onZoomChanged={setZoom}
      />
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

## Initial fit

To fit the data without binding time and zoom:

```tsx
<Timescope options={options} initialFit={{ range: [0, 30], padding: 24 }} />
```

## Options and events

| Task                            | Solid syntax                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| Set chart height                | `style` with a CSS object containing `height: '240px'`                      |
| Update options                  | Return a new complete object from `createMemo`; pass `options={options()}`  |
| Bind a selection                | `selectionRange={selection()}` and `onSelectionRangeChanged={setSelection}` |
| Follow the clock                | `setTime(null)`                                                             |
| Handle readiness                | `onReady={onReady}`                                                         |
| Preview time during interaction | `onTimeChanging={setPreview}`                                               |
| Style the host element          | `class` and `style`                                                         |

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props and callbacks](/api/frameworks) · [Data updates](/guide/advanced/data)
