---
titleTemplate: Timescope API
---

# Framework Components

Public components, props, events, and refs provided by `@timescope/*`.

| Package             | Component   | Guide                                       |
| ------------------- | ----------- | ------------------------------------------- |
| `@timescope/vue`    | `Timescope` | [Vue](/guide/advanced/frameworks/vue)       |
| `@timescope/react`  | `Timescope` | [React](/guide/advanced/frameworks/react)   |
| `@timescope/svelte` | `Timescope` | [Svelte](/guide/advanced/frameworks/svelte) |
| `@timescope/solid`  | `Timescope` | [Solid](/guide/advanced/frameworks/solid)   |
| `@timescope/luna`   | `Timescope` | [Luna](/guide/advanced/frameworks/luna)     |

## Props

| Prop              | Type                                                                       | Description                                       |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `options?`        | `TimescopeOptions`                                                         | Complete chart configuration; updates replace it. |
| `time?`           | `Decimal \| number \| string \| Date \| null`                              | Selected time; `null` follows the clock.          |
| `zoom?`           | `number`                                                                   | Selected zoom level.                              |
| `timeRange?`      | `TimescopeRange<Decimal \| number \| string \| Date \| null \| undefined>` | Navigation bounds.                                |
| `zoomRange?`      | `TimescopeRange<number \| undefined>`                                      | Zoom bounds.                                      |
| `selectionRange?` | `TimescopeRange<Decimal> \| null`                                          | Selected range; `null` clears it.                 |

### Creation-only props

| Prop            | Type                                                                                                                                    | Default | Description                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `initialTime?`  | `Decimal \| number \| string \| Date \| null`                                                                                           | `null`  | Creation-time selection; a defined `time` takes precedence.                                                                 |
| `initialZoom?`  | `number`                                                                                                                                | `0`     | Creation-time zoom; a defined `zoom` takes precedence.                                                                      |
| `initialFit?`   | `TimescopeRange<TimescopeTimeLike<never>> \| { range: TimescopeRange<TimescopeTimeLike<never>>, padding?: number \| [number, number] }` | —       | Fits the initial range with CSS-pixel padding; requires undefined `time` and `zoom`, and no `initialTime` or `initialZoom`. |
| `renderThread?` | `'main' \| 'worker'`                                                                                                                    | Auto    | Rendering thread selected at creation.                                                                                      |
| `fonts?`        | `(string \| { family: string, source: string \| BufferSource, desc?: FontFaceDescriptors })[]`                                          | Auto    | Additional browser font data loaded at creation.                                                                            |

| Framework | Input prop type  |
| --------- | ---------------- |
| Luna      | `T \| (() => T)` |

[Guide](/guide/advanced/frameworks/overview#configuration-and-state)

### Host props

| Framework | Props                                                                  |
| --------- | ---------------------------------------------------------------------- |
| React     | `style?: CSSProperties`, `className?: string`                          |
| Solid     | `style?: any`, `class?: any`                                           |
| Vue       | Native `<div>` attributes                                              |
| Svelte    | `style?: string`, `class?: string`                                     |
| Luna      | `style?: string \| (() => string)`, `class?: string \| (() => string)` |

[Guide](/guide/advanced/frameworks/overview#lifecycle)

## Events and callbacks

| Vue / Svelte event       | React / Solid / Luna callback | Value                             | Description                           |
| ------------------------ | ----------------------------- | --------------------------------- | ------------------------------------- |
| `timechanged`            | `onTimeChanged?`              | `Decimal \| null`                 | Selected time is committed.           |
| `timechanging`           | `onTimeChanging?`             | `Decimal \| null`                 | Time changes during interaction.      |
| `timeanimating`          | `onTimeAnimating?`            | `Decimal \| null`                 | Time animation progresses.            |
| `zoomchanged`            | `onZoomChanged?`              | `number`                          | Selected zoom is committed.           |
| `zoomchanging`           | `onZoomChanging?`             | `number`                          | Zoom changes during interaction.      |
| `zoomanimating`          | `onZoomAnimating?`            | `number`                          | Zoom animation progresses.            |
| `selectionrangechanged`  | `onSelectionRangeChanged?`    | `TimescopeRange<Decimal> \| null` | Selection is committed or cleared.    |
| `selectionrangechanging` | `onSelectionRangeChanging?`   | `TimescopeRange<Decimal> \| null` | Selection changes during interaction. |
| `animating`              | `onAnimating?`                | `boolean`                         | Time-animation activity changes.      |
| `editing`                | `onEditing?`                  | `boolean`                         | Time-editing state changes.           |
| `ready`                  | `onReady?`                    | —                                 | First drawable mount.                 |
| `mount`                  | `onMount?`                    | —                                 | Each drawable mount.                  |

[Guide](/guide/advanced/frameworks/overview#events-and-refs) · [Timescope events](/api/classes#timescope-events)

## Component refs

| Framework | Ref type       | Methods                                                   |
| --------- | -------------- | --------------------------------------------------------- |
| Vue       | —              | `setTime`, `setZoom`, `fitTo`, `prepareView`, `nextFrame` |
| React     | `TimescopeAPI` | `setTime`, `setZoom`, `fitTo`, `prepareView`, `nextFrame` |
| Svelte    | —              | `setTime`, `setZoom`, `fitTo`, `prepareView`, `nextFrame` |

[Method signatures](/api/classes#timescope-methods) · [Guide](/guide/advanced/frameworks/overview#events-and-refs)

| Vue ref properties       | Type                              | Description                       |
| ------------------------ | --------------------------------- | --------------------------------- |
| `time`                   | `Decimal \| null`                 | Committed selected time.          |
| `timeChanging`           | `Decimal \| null`                 | Time during interaction.          |
| `timeAnimating`          | `Decimal \| null`                 | Time during animation.            |
| `zoom`                   | `number`                          | Committed zoom level.             |
| `zoomChanging`           | `number`                          | Zoom during interaction.          |
| `zoomAnimating`          | `number`                          | Zoom during animation.            |
| `selectionRange`         | `TimescopeRange<Decimal> \| null` | Committed selected range.         |
| `selectionRangeChanging` | `TimescopeRange<Decimal> \| null` | Selection during interaction.     |
| `animating`              | `boolean`                         | Whether time animation is active. |
| `editing`                | `boolean`                         | Whether time is being edited.     |
