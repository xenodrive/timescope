---
titleTemplate: Timescope API
---
# Timescope

The `Timescope` class manages rendering, user interaction, and data processing. Instances are created via the constructor and can be reconfigured using `setOptions` or `updateOptions`.

## Constructor

```TypeScript
new Timescope(options?: TimescopeOptions)
```

Creates a new Timescope instance with the provided options.

### Options (constructor only)

All other option fields are defined in [Timescope Options](/api/timescope-options).

| Key | Type | Description |
|-----|------|-------------|
| `time` | `TimeLike \| null` | Initial cursor time (use `setTime()` later). |
| `timeRange` | `[TimeLike?, TimeLike?]` | Initial timeline bounds (use `setTimeRange()` later). |
| `zoom` | `ZoomLike` | Initial zoom (use `setZoom()` later). |
| `zoomRange` | `[ZoomLike?, ZoomLike?]` | Initial zoom limits (use `setZoomRange()` later). |
| `target` | `HTMLElement \| string` | Mount target. |
| `fonts` | `(string \| FontOptions)[]` | Fonts to load. |


#### Fonts

Load custom fonts for rendering.

>[!NOTE]
> Fonts must be loaded separately because Timescope uses Web Worker for rendering.

1. URL strings:
```TypeScript
fonts: ['https://example.com/font.woff2']
```

2. Font objects:
```TypeScript
fonts: [{
  family: 'CustomFont',
  source: 'https://example.com/font.woff2',  // URL or ArrayBuffer
  desc: { weight: '400', style: 'normal' },
}]
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `time` | `Decimal \| null` | Current cursor time |
| `timeRange` | `[Decimal?, Decimal?]` | Time bounds |
| `zoom` | `Decimal` | Current zoom value |
| `zoomRange` | `[Decimal?, Decimal?]` | Zoom limits |
| `size` | `{ x, y, width, height }` | Canvas dimensions |
| `disabled` | `boolean` | Interaction enabled/disabled |
| `animating` | `boolean` | Animation in progress |
| `editing` | `boolean` | User is dragging |
| `options` | `TimescopeOptions` | Current options |

## Methods

| Method | Purpose |
|--------|---------|
| `setTime(value, animation?)` | Update the cursor time. Pass `null` to follow "now". See [Animation](#animation). |
| `setTimeRange(range?)` | Constrain the time domain. Pass `undefined` to restore defaults. |
| `setZoom(value, animation?)` | Set zoom programmatically. See [Animation](#animation). |
| `setZoomRange(range?)` | Clamp zoom to `[min, max]`. |
| `fitTo(range, options?)` | Center and zoom to show `[start, end]` fully. |
| `setSelection(range?)` | Highlight `[start, end]` on the canvas; emits range events while the selection overlay updates. |
| `clearSelection()` | Remove the selection overlay. |
| `setOptions(next)` | Replace style, sources, or series at runtime. |
| `updateOptions(next)` | Merge partial option changes (e.g., swap a single chart) without recreating the whole Timescope instance. |
| `mount(target)` | Append the canvas to a selector or element. Returns `this`. |
| `unmount()` | Remove the canvas without destroying the renderer. |
| `dispose()` | Dispose the Timescope instance and clean up all resources. |
| `on(event, handler)` | Subscribe to events. Returns an unsubscribe function. |

`setOptions` replaces the entire configuration. `updateOptions` merges partial changes, which is more efficient for incremental updates like toggling chart presets.

### Animation

The `animation` parameter in `setTime()` and `setZoom()` controls transition behavior:

```TypeScript
// No animation (instant change)
timescope.setTime(100, false);

// Animated with default easing ('in-out') and duration (500ms)
timescope.setTime(100, 'in-out');

// Other easing types
timescope.setTime(100, 'linear');
timescope.setTime(100, 'out');

// Custom duration
timescope.setTime(100, { animation: 'in-out', duration: 1000 });
```

Available easing types:
- `'in-out'` — Smooth start and end (default)
- `'linear'` — Constant speed
- `'out'` — Fast start, slow end
- `false` — No animation

## Events

| Event | Payload | Timing |
|-------|---------|--------|
| `timechanging` | `Decimal \| null` | Fired continuously while time changes. |
| `timechanged` | `Decimal \| null` | Fired once when time settles. |
| `zoomchanging` | `number` | Fired continuously while zoom changes. |
| `zoomchanged` | `number` | Fired once when zoom settles. |
| `selectionchanging` | `[Decimal, Decimal]` | Fired while a selection range is being resized. |
| `selectionchanged` | `[Decimal, Decimal] \| null` | Fired after selection settles or clears. |

Range events are emitted when the selection overlay is active. Enable selection via the `selection` option or `setSelection()` method.

Event handlers receive an object with a `value` property. The `on` method returns an unsubscribe function.

## See Also

- [Timescope Options](/api/timescope-options)
- [Chunk Loading guide](/guide/chunk-loading)
- [Events guide](/guide/events)
