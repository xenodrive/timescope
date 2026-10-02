---
title: Overview
---

# Overview

Framework components accept the same chart configuration as [Drawing a Chart](/guide/drawing-a-chart), through an `options` prop. Install the `@timescope/*` package for your framework and follow its guide:

- [Vue](/guide/advanced/frameworks/vue) uses `v-model` to synchronize state.
- [React](/guide/advanced/frameworks/react) pairs props with change callbacks.
- [Svelte](/guide/advanced/frameworks/svelte) uses `bind:` with Svelte 5 state.
- [Solid](/guide/advanced/frameworks/solid) uses signal values and change callbacks.
- [Luna](/guide/advanced/frameworks/luna) uses signal accessors and change callbacks.

## Configuration and state

`options` is a complete chart configuration. Updates replace it, like [`setOptions()`](/api/classes#timescope-methods); omitted settings revert to defaults. Keep the same DataSource instances when changing presentation settings to retain loaded data; see [source lifetime](/api/interfaces#timescopedatasource-invalidation).

Pass a new complete `options` object for updates. Vue also observes nested reactive changes.

Navigation state is passed separately from `options`:

- Omit `time` and `zoom` to let the chart manage its view. Use `initialFit` to fit a range at creation, or set `initialTime` and `initialZoom` explicitly.
- Bind `time`, `zoom`, or `selectionRange` to synchronize application state with chart interaction. Time changes yield `Decimal | null`, zoom changes yield `number`, and selection changes yield `[Decimal, Decimal] | null`.
- Set `time` to `null` to [follow the clock](/guide/concepts#time-and-zoom); this is not the same as omitting the prop.

`initialFit` applies only when both `time` and `zoom` are undefined at creation. Do not combine it with `initialTime` or `initialZoom`. These initial props are creation-only; changing them later does not navigate.

`initialTime` defaults to `null` and `initialZoom` to `0`; defined `time` and `zoom` props take precedence over their initial counterparts. `initialFit` accepts a range or `{ range, padding }`, with padding in CSS pixels. `renderThread` and `fonts` are also creation-only; see [component props](/api/frameworks#props).

Luna input props accept either a value or an accessor returning that value. Use accessors for reactive inputs, as shown in the [Luna guide](/guide/advanced/frameworks/luna).

## Events and refs

Event handlers and change callbacks receive the changed value directly, except Svelte events, which expose it as `event.detail`. The `changing` events preview interaction state, `changed` events commit it, and `animating` events report animation progress. `animating` / `onAnimating` indicates a time animation; `editing` / `onEditing` indicates time editing.

Vue, React, and Svelte refs expose `setTime`, `setZoom`, `fitTo`, `prepareView`, and `nextFrame` after mounting, with the same signatures as the core instance. React exports the ref type `TimescopeAPI`; Vue refs also expose navigation, selection, animation, and editing state. Use a ref's prepared view and `nextFrame()` when exporting pixels, rather than relying on mount events.

[Event and ref types](/api/frameworks#events-and-callbacks)

## Lifecycle

Components own their mount targets and dispose the Timescope automatically, including listeners registered with its `on()` method. Manually unsubscribe only if a subscription should end before the instance is disposed. Clean up application-owned timers, data producers, and listeners on external objects yourself on component unmount; see [Cleanup](/guide/getting-started#cleanup).

Set chart dimensions and background with CSS on the host element, using the component's `style` or class prop and a definite height. `ready` / `onReady` fires at the first drawable mount and `mount` / `onMount` at each drawable mount. These mean the canvas has a non-zero size, not that data loading is complete; use a [prepared view](/api/interfaces#timescopepreparedview) and `nextFrame()` when you need finished pixels.

[Props, events, and component refs](/api/frameworks) · [Styling and fonts](/guide/advanced/styling)
