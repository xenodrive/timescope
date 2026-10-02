---
titleTemplate: Timescope API
---

# Utilities

Public functions and default values exported from `timescope`.

## defineTimescopeOptions

```ts
defineTimescopeOptions(options: TimescopeOptions): TimescopeOptions
```

[TimescopeOptions](/api/types#timescopeoptions) · [Guide](/guide/advanced/views#typed-configuration)

## createDefineTimescopeOptions

```ts
createDefineTimescopeOptions(wrapper?: (options: object) => object): typeof defineTimescopeOptions
```

[Guide](/guide/advanced/views#typed-configuration)

## createDataLoader

```ts
createDataLoader(options: TimescopeDataLoaderOptions): TimescopeDataLoader
```

[Options](/api/types#timescopedataloaderoptions) · [TimescopeDataLoader](/api/classes#timescopedataloader) · [Guide](/guide/advanced/data#reuse-a-dataloader)

## createDataSource

```ts
createDataSource<S extends TimescopeDataSource>(input: S): S
createDataSource(input: TimescopeSourceOptions & { type: 'point-aggregate' }): TimescopeAppendOnlyDataSource
createDataSource(input: TimescopeSourceInput): TimescopeDataSource
```

[Source inputs](/api/types#timescopesourceinput) · [TimescopeDataSource](/api/interfaces#timescopedatasource) · [Guide](/guide/advanced/data)

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

[Guide](/guide/advanced/views#reuse-default-values)
