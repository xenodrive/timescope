---
title: Framework Bindings
---

# Framework Bindings

Timescope's framework components manage mounting and disposal, apply configuration, and report user interaction to your application. They all render the same charts; choose a binding for the state and lifecycle conventions of your framework.

## Choose a binding

Install the appropriate binding. It includes `timescope` as a dependency; each guide includes a rendered preview and a complete component example.

| Framework                                   | Package             | State synchronization                 |
| ------------------------------------------- | ------------------- | ------------------------------------- |
| [Vue](/guide/advanced/frameworks/vue)       | `@timescope/vue`    | `v-model`                             |
| [React](/guide/advanced/frameworks/react)   | `@timescope/react`  | Props and change callbacks            |
| [Svelte](/guide/advanced/frameworks/svelte) | `@timescope/svelte` | `bind:` with Svelte 5 state           |
| [Solid](/guide/advanced/frameworks/solid)   | `@timescope/solid`  | Signal values and change callbacks    |
| [Luna](/guide/advanced/frameworks/luna)     | `@timescope/luna`   | Signal accessors and change callbacks |

## Configuration and current state

Keep chart configuration and the current view separate:

| Input                                      | Use it for                                                              | When it takes effect         |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------- |
| `options`                                  | Sources, series, tracks, domains, chart style, and selection appearance | At creation and when updated |
| `time`, `zoom`, `selectionRange`           | The current cursor, zoom level, and selection                           | At creation and when updated |
| `timeRange`, `zoomRange`                   | Navigation limits                                                       | At creation and when updated |
| `initialTime`, `initialZoom`, `initialFit` | A one-time starting view                                                | At creation only             |
| `renderThread`, `fonts`                    | Rendering and font setup                                                | At creation only             |

`options` accepts [Timescope Options](/api/timescope-options). An options update **replaces** the configuration, as with `setOptions()`: include all settings you want to retain. It preserves current time and zoom. Use `selectionRange` for the current selection; `options.selection` controls its appearance and whether selection is enabled.

Set the chart's size through `options.style`, for example `{ style: { height: '240px' } }`. The component creates its own drawing target. For an external canvas or explicit backend selection, use the [Timescope class](/guide/advanced/backends) directly.

How an options update is detected differs by framework: Vue supports nested reactive changes; the other guides show how to supply new options objects. Keep reusable [DataSource instances](/guide/advanced/data#reuse-a-source) stable when changing presentation settings.

## Synchronize interactions

Connect both directions when the parent needs to track the chart:

1. Pass the current value to the component.
2. Store values reported by the component back into application state.

Vue and Svelte offer two-way bindings. React, Solid, and Luna pair each current-value prop with a change callback. If the application does not need the current view, omit these bindings and let Timescope manage it.

| Current value    | Reported type                | Special values                |
| ---------------- | ---------------------------- | ----------------------------- |
| `time`           | `Decimal \| null`            | `null` follows the live clock |
| `zoom`           | `number`                     | Larger values zoom in         |
| `selectionRange` | `[Decimal, Decimal] \| null` | `null` clears the selection   |

Time inputs also accept numbers, date strings, and `Date` objects. Values reported by the chart use `Decimal`, so allow that type in application state even if the initial input is a number.

Passing `undefined` directly for a current-value prop leaves an existing value alone. It is not a reset command. See [Luna's accessor rules](/guide/advanced/frameworks/luna#accessor-props) when a prop is a function returning a value.

Use the _changed_ notifications for synchronized state. The _changing_ and _animating_ notifications are useful for displaying intermediate values during dragging or animation; see the [Events example](/guide/examples/#events). Binding callbacks receive the value directly, rather than the core API's `{ type, value }` event object. Svelte component events expose it as `event.detail`.

## Choose the initial view

There are three ways to start:

- **Restore application state:** provide `time` and `zoom` with their change bindings.
- **Start at a fixed position:** use `initialTime` and `initialZoom`. Defined current-value props take precedence over the corresponding initial values.
- **Show a whole interval:** use `initialFit`, leaving `time` and `zoom` undefined at creation. The fitted values are reported through the usual bindings.

`initialFit` accepts `[start, end]` or `{ range: [start, end], padding: 24 }`. Padding is in CSS pixels; use `[left, right]` for different margins. Fitting happens once, after the chart has a size. Do not combine `initialFit` with `initialTime` or `initialZoom`.

Without an initial view, the chart follows the live clock at zoom `0`. Changing an `initial*` prop later does not navigate the chart; update current-value props or use an exposed method instead.

## Lifecycle and imperative controls

The component mounts the chart with its element and disposes it when removed. In a server-rendered application, place interactive charts in the framework's client-side mounting boundary.

- **`ready` / `onReady`:** the first mount is drawable, with a non-zero size.
- **`mount` / `onMount`:** each mount becomes drawable.

To wait for data and pixels, use [prepared views and `nextFrame()`](/guide/advanced/views#wait-for-data-and-drawing).

Vue, React, and Svelte expose `setTime()`, `setZoom()`, `fitTo()`, `prepareView()`, and `nextFrame()` through their component refs. Call them after mounting; the individual guides show the ref syntax. Solid and Luna use props and callbacks for view control.

See [Rendering Backends](/guide/advanced/backends#rendering-threads) for `renderThread` and [Fonts](/guide/advanced/backends#fonts) for `fonts`. Changes to these creation-only props require a new component instance.
