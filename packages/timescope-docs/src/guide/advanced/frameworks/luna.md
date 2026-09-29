---
title: Luna
---

<script setup>
import ChartPreview from './chart-preview.vue';
</script>

# Luna

Pass signal accessors to keep Luna state connected to the chart. The [shared binding guide](/guide/advanced/frameworks) covers configuration, initial views, and lifecycle rules.

## Install

```bash
npm install @timescope/luna @luna_ui/luna
```

## Chart and accessor state

<ChartPreview />

Pass `time` and `zoom` themselves as props. The chart reads the accessors and reports changes to their setters. The button navigates through the same signal.

```tsx
import { createSignal } from '@luna_ui/luna';
import { Timescope, defineTimescopeOptions, Decimal } from '@timescope/luna';

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
      <Timescope options={options} time={time} onTimeChanged={setTime} zoom={zoom} onZoomChanged={setZoom} />
      <button type="button" onclick={() => setTime(Decimal(15))}>
        Center at 15
      </button>
      <output>{() => `Time: ${time()?.toString() ?? 'live'} · Zoom: ${zoom().toFixed(2)}`}</output>
    </>
  );
}
```

## Accessor props

| Reactive input        | Luna syntax                                                   |
| --------------------- | ------------------------------------------------------------- |
| Current time and zoom | `time={time}`, `zoom={zoom}`                                  |
| Current selection     | `selectionRange={selection}`                                  |
| Navigation limits     | `timeRange={timeRange}`, `zoomRange={zoomRange}`              |
| Configuration         | `options={options}` where `options` returns the configuration |

These props also accept plain values. For reactive inputs, pass the **accessor**, such as `time={time}`; passing `time={time()}` supplies the value read at that point instead.

Pair current-value accessors with `onTimeChanged`, `onZoomChanged`, and `onSelectionRangeChanged`. Callbacks receive values directly. Reactive child text also uses an accessor, as in the example's `<output>`.

Keep controlled accessors initialized: an accessor returning `undefined` is treated as `null` for time and selection, or `0` for zoom. This differs from omitting the prop. For a fitted, chart-managed initial view, omit current-value props:

```tsx
<Timescope options={options} initialFit={[0, 30]} />
```

Initial values, `renderThread`, and `fonts` can also be accessors, but are only read when the instance is created.

## Reactive configuration

An options accessor can derive the configuration from application signals:

```tsx
const options = () =>
  defineTimescopeOptions({
    style: { height: '240px' },
    sources: { values: source },
    series: { values: { data: { source: 'values', color: color() }, chart: 'lines' } },
  });

return <Timescope options={options} initialFit={[0, 30]} />;
```

Here `source` is a stable DataSource and `color` is a signal accessor. Return a new configuration when settings change; keep sources stable for [data updates](/guide/advanced/data#reuse-a-source).

## Notifications and view control

Use `onTimeChanging` and `onTimeAnimating` to display intermediate positions, and `onReady` or `onMount` for drawable lifecycle events. Control the view through props and signals; the Luna binding does not expose a component imperative ref.
