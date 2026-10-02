---
title: Luna
---

# Luna

Install `timescope` for core helpers and types, and `@timescope/luna` for the Luna component.

```bash
npm install timescope @timescope/luna @luna_ui/luna
```

## Bind time and zoom

Pass signal accessors, not their current values, for reactive props and child text. Change callbacks receive values directly and update Luna signals:

```tsx
import { createSignal } from '@luna_ui/luna';
import { Timescope } from '@timescope/luna';
import { Decimal, defineTimescopeOptions } from 'timescope';

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
        style="height: 240px"
        options={options}
        time={time}
        onTimeChanged={setTime}
        zoom={zoom}
        onZoomChanged={setZoom}
      />
      <button type="button" onclick={() => setTime(Decimal(15))}>
        Center at 15
      </button>
      <output>{() => `Time: ${time()?.toString() ?? 'live'} · Zoom: ${zoom().toFixed(2)}`}</output>
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

| Task                            | Luna syntax                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Style the host element          | `style="height: 240px; background: white"` or `class`; accessors are supported |
| Update options                  | `options={() => ...}` returning a new complete object                          |
| Bind a selection                | `selectionRange={selection}` and `onSelectionRangeChanged={setSelection}`      |
| Follow the clock                | `setTime(null)`                                                                |
| Handle readiness                | `onReady={onReady}`                                                            |
| Preview time during interaction | `onTimeChanging={setPreview}`                                                  |

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props and callbacks](/api/frameworks) · [Data updates](/guide/advanced/data)
