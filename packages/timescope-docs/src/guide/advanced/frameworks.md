---
title: Framework Bindings
---

# Framework Bindings

Use the chart configuration from [Drawing a Chart](/guide/drawing-a-chart) through a framework component's `options` prop. Choose one binding below; the examples are alternatives, not successive steps.

| Framework                                   | Package             | State synchronization                 |
| ------------------------------------------- | ------------------- | ------------------------------------- |
| [Vue](/guide/advanced/frameworks/vue)       | `@timescope/vue`    | `v-model`                             |
| [React](/guide/advanced/frameworks/react)   | `@timescope/react`  | Props and change callbacks            |
| [Svelte](/guide/advanced/frameworks/svelte) | `@timescope/svelte` | `bind:` with Svelte 5 state           |
| [Solid](/guide/advanced/frameworks/solid)   | `@timescope/solid`  | Signal values and change callbacks    |
| [Luna](/guide/advanced/frameworks/luna)     | `@timescope/luna`   | Signal accessors and change callbacks |

## Configuration and state

`options` is a complete chart configuration. Updates replace it, like [`setOptions()`](/api/timescope#configuration); omitted settings revert to defaults. Keep [DataSource instances stable](/guide/advanced/data#reuse-a-source) when changing presentation settings.

Navigation state is passed separately from `options`:

- Omit `time` and `zoom` to let the chart manage its view. Use `initialFit` to fit a range at creation, or set `initialTime` and `initialZoom` explicitly.
- Bind `time`, `zoom`, or `selectionRange` to synchronize application state with chart interaction. Time changes yield `Decimal | null`, zoom changes yield `number`, and selection changes yield `[Decimal, Decimal] | null`.
- Set `time` to `null` to [follow the clock](/guide/concepts#time-and-zoom); this is not the same as omitting the prop.

`initialFit` applies only when both `time` and `zoom` are undefined at creation. Do not combine it with `initialTime` or `initialZoom`. These initial props are creation-only; changing them later does not navigate.

## Lifecycle

Components own their mount targets and dispose the Timescope automatically. Set chart dimensions and background with CSS on the host element, using the component's `style` or class prop. Without a definite host height, the canvas uses a `36px` fallback. `ready` / `onReady` means the canvas has a non-zero size, not that data loading is complete; for export, [wait for data and drawing](/guide/advanced/views#wait-for-data-and-drawing). Stop application-owned timers and data producers on unmount.

[Props, events, and component refs](/api/frameworks) · [Rendering and fonts](/guide/advanced/backends)
