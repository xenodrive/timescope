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

For reactive configuration, pass an `options` accessor that returns a new complete object when its dependencies change. The `style` and `class` props also accept accessors, so the host's dimensions and background can follow your application state.

To synchronize a selection, pass its accessor as `selectionRange={selection}` and update it with `onSelectionRangeChanged={setSelection}`. Call `setTime(null)` to follow the clock.

Use `onTimeChanging={setPreview}` to preview time during interaction. `onReady={onReady}` tells you when the canvas is mounted and drawable.

[Shared component behavior](/guide/advanced/frameworks/overview#configuration-and-state) · [Props and callbacks](/api/frameworks) · [Data updates](/guide/advanced/data)
