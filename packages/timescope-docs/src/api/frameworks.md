---
titleTemplate: Timescope API
---

# Framework Components

The `@timescope/*` packages wrap a Timescope instance in a component for each supported framework. They manage mounting and disposal, and expose chart configuration, reactive state, and change notifications through props and framework bindings.

| Package             | Component   | Usage                                       |
| ------------------- | ----------- | ------------------------------------------- |
| `@timescope/vue`    | `Timescope` | [Vue](/guide/advanced/frameworks/vue)       |
| `@timescope/react`  | `Timescope` | [React](/guide/advanced/frameworks/react)   |
| `@timescope/svelte` | `Timescope` | [Svelte](/guide/advanced/frameworks/svelte) |
| `@timescope/solid`  | `Timescope` | [Solid](/guide/advanced/frameworks/solid)   |
| `@timescope/luna`   | `Timescope` | [Luna](/guide/advanced/frameworks/luna)     |

## Props

| Prop             | Type                                                                                           | Contract                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `options`        | `TimescopeOptions`                                                                             | Complete configuration; updates replace it                                 |
| `time`           | `Decimal \| number \| string \| Date \| null`                                                  | Selected time; `null` follows the clock                                    |
| `zoom`           | `number`                                                                                       | Selected zoom level                                                        |
| `timeRange`      | `[time \| undefined, time \| undefined]`                                                       | Navigation bounds; endpoint type as for `time`                             |
| `zoomRange`      | `[number \| undefined, number \| undefined]`                                                   | Zoom bounds                                                                |
| `selectionRange` | `[Decimal, Decimal] \| null`                                                                   | Selected range; `null` clears it                                           |
| `initialTime`    | Same as `time`                                                                                 | Creation-only; default `null`; defined `time` takes precedence             |
| `initialZoom`    | `number`                                                                                       | Creation-only; default `0`; defined `zoom` takes precedence                |
| `initialFit`     | `[start, end] \| { range: [start, end], padding?: number \| [left, right] }`                   | Creation-only; endpoints `TimescopeTimeLike<never>`; padding in CSS pixels |
| `renderThread`   | `'main' \| 'worker'`                                                                           | Creation-only; automatic when omitted                                      |
| `fonts`          | `(string \| { family: string, source: string \| BufferSource, desc?: FontFaceDescriptors })[]` | Creation-only; [font inputs](/api/timescope#fonts)                         |

`initialFit` requires creation-time `time` and `zoom` to be undefined; incompatible with `initialTime` / `initialZoom`. [Configuration and lifecycle](/guide/advanced/frameworks/overview).

## Reactive inputs

| Framework | Host styling inputs                                     |
| --------- | ------------------------------------------------------- |
| React     | CSS-object `style`; `className`                         |
| Solid     | `style`; `class`                                        |
| Vue       | Native `style`; `class`                                 |
| Svelte    | CSS-string `style`; string `class`                      |
| Luna      | CSS-string `style`; string `class`; values or accessors |

Host styling applies to the target element. [Styling components](/guide/advanced/frameworks/overview#lifecycle).

| Framework | State input                                               | Options updates                        |
| --------- | --------------------------------------------------------- | -------------------------------------- |
| Vue       | `v-model:time`, `v-model:zoom`, `v-model:selection-range` | Nested reactive changes or replacement |
| React     | Value props and change callbacks                          | New complete options object            |
| Svelte    | `bind:time`, `bind:zoom`, `bind:selectionRange`           | New complete options object            |
| Solid     | Signal values                                             | New complete options object            |
| Luna      | Values or accessors                                       | New complete options object            |

## Events and callbacks

| Vue / Svelte event       | React / Solid / Luna callback | Value                            |
| ------------------------ | ----------------------------- | -------------------------------- |
| `timechanged`            | `onTimeChanged`               | `Decimal \| null`                |
| `timechanging`           | `onTimeChanging`              | `Decimal \| null`                |
| `timeanimating`          | `onTimeAnimating`             | `Decimal \| null`                |
| `zoomchanged`            | `onZoomChanged`               | `number`                         |
| `zoomchanging`           | `onZoomChanging`              | `number`                         |
| `zoomanimating`          | `onZoomAnimating`             | `number`                         |
| `selectionrangechanged`  | `onSelectionRangeChanged`     | `[Decimal, Decimal] \| null`     |
| `selectionrangechanging` | `onSelectionRangeChanging`    | `[Decimal, Decimal] \| null`     |
| `animating`              | `onAnimating`                 | `boolean`; time animation active |
| `editing`                | `onEditing`                   | `boolean`; time being edited     |
| `ready`                  | `onReady`                     | No value; first drawable mount   |
| `mount`                  | `onMount`                     | No value; each drawable mount    |

| Handler form                                   | Payload        |
| ---------------------------------------------- | -------------- |
| Vue `@timechanged="handler"`                   | Value directly |
| Svelte `on:timechanged={handler}`              | `event.detail` |
| React / Solid / Luna `onTimeChanged={handler}` | Value directly |

Event timing: [Timescope events](/api/timescope#events).

## Component refs

| Framework    | Ref                                      | Available methods                                         |
| ------------ | ---------------------------------------- | --------------------------------------------------------- |
| Vue          | Template `ref`; `useTemplateRef()`       | `setTime`, `setZoom`, `fitTo`, `prepareView`, `nextFrame` |
| React        | `ref`; `useRef<TimescopeAPI>(null)`      | Same five methods                                         |
| Svelte       | `bind:this`; inferred component instance | Same five methods                                         |
| Solid / Luna | —                                        | State control through props and callbacks                 |

Method signatures: [Timescope methods](/api/timescope#methods). Ref methods require a mounted component.

| Vue ref properties                         | Type                         |
| ------------------------------------------ | ---------------------------- |
| `time`, `timeChanging`, `timeAnimating`    | `Decimal \| null`            |
| `zoom`, `zoomChanging`, `zoomAnimating`    | `number`                     |
| `selectionRange`, `selectionRangeChanging` | `[Decimal, Decimal] \| null` |
| `animating`, `editing`                     | `boolean`                    |
