---
titleTemplate: Timescope API
---

# Utilities

Public functions and default values exported from `timescope`.

## defineTimescopeOptions

```ts
defineTimescopeOptions(options: TimescopeOptions): TimescopeOptions
```

Returns the same object, preserving inferred source names, row fields, metadata, and Track names while checking their references.

[TimescopeOptions](/api/types#timescopeoptions) · [Shared configuration](/guide/advanced/running-on-node#share-chart-configuration-and-loaders)

## createDefineTimescopeOptions

```ts
createDefineTimescopeOptions(wrapper?: (options: object) => object): typeof defineTimescopeOptions
```

Creates a typed options helper around a wrapper such as a framework's reactive helper. Returns the wrapper's result with the input's inferred type; the wrapper must preserve the options structure and value types. Without a wrapper, returns the input unchanged.

## createDataLoader

```ts
createDataLoader(options: TimescopeDataLoaderOptions): TimescopeDataLoader
```

Infers snapshot or range mode and preserves a supplied loader's mode. A shared loader shares acquisition settings, not loaded data or invalidation state.

[Options](/api/types#timescopedataloaderoptions) · [TimescopeDataLoader](/api/classes#timescopedataloader)

## createDataSource

```ts
createDataSource<S extends TimescopeDataSource>(input: S): S
createDataSource(input: TimescopeSourceOptions & { type: 'point-aggregate' }): TimescopeAppendOnlyDataSource
createDataSource(input: TimescopeSourceInput): TimescopeDataSource
```

Infers row and field types from input. A `'point-aggregate'` source supports appending; an already supplied DataSource is returned unchanged.

[Source inputs](/api/types#timescopesourceinput) · [TimescopeDataSource](/api/interfaces#timescopedatasource) · [Live Streaming](/guide/advanced/live-streaming)

## defaultOptions

| Property           | Value / type                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time`             | `null`                                                                                                                                             |
| `zoom`             | `0`                                                                                                                                                |
| `wheelSensitivity` | `200`                                                                                                                                              |
| `fit`              | `{ padding: 0 }`                                                                                                                                   |
| `options`          | `{ font: undefined, cursor: true, showFps: false, sources: undefined, series: undefined, tracks: undefined, domains: undefined, selection: true }` |
| `cursor`           | `{ color: 'transparent', borderColor: 'red' }`                                                                                                     |
| `domain`           | `{ scale: 'linear', animation: true, floatingGap: 20, axis: false, unit: '' }`                                                                     |
| `domainRange`      | `{ default: [undefined, undefined], expand: false, shrink: true }`                                                                                 |
| `track`            | `{ height: undefined, symmetric: false, timeAxis: true }`                                                                                          |
| `timeAxis`         | `{ relative: false, timeZone: 'local', timeUnit: 's' }`                                                                                            |
| `series`           | `{ tooltip: true, fillAlpha: 0.25, instantaneous: { using: 'value' }, colors: ['#080', '#800', '#008', '#880', '#088', '#808'] }`                  |
| `chartStyle`       | `{ lineWidth: 1, fillOpacity: 1, radius: 0, offset: [0, 0], textAlign: 'center' }`                                                                 |
| `chartSize`        | `{ mark: 5, text: 14, icon: 16 }`                                                                                                                  |
| `chartUsing`       | `Readonly<Record<'point' \| 'area' \| 'range' \| 'region', Readonly<Using>>>`                                                                      |
| `source`           | `{ chunkSize: 256, chunkOrigin: 0, immediate: true, cacheSize: 1000 }`                                                                             |

Groups and arrays are frozen; copy individual groups when customizing. This is not a complete constructor configuration and contains no named DataSources, Series, Domains, or Tracks. Unspecified Track heights share available space, a Series uses the first Track, and primitive colors inherit the Series color; leaving those settings unspecified preserves their contextual defaults.
