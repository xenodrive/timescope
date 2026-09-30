# API Reference

| Reference                                   | Contents                                                |
| ------------------------------------------- | ------------------------------------------------------- |
| [Timescope](/api/timescope)                 | Constructor, state, methods, prepared views, events     |
| [Timescope Options](/api/timescope-options) | DataSources, Series, Charts, Tracks, Domains, selection |
| [Framework Components](/api/frameworks)     | Props, bindings, callbacks, component refs              |
| [Decimal](/api/decimal)                     | Numeric inputs, arithmetic, rounding, conversion        |
| [Calendar](/api/calendar)                   | Date components, time zones, alignment, format tokens   |

```ts
import {
  Timescope,
  createDataSource,
  createDataLoader,
  defineTimescopeOptions,
  defaultOptions,
  Decimal,
  Calendar,
} from 'timescope';
import type { TimescopeOptions, TimescopeUpdateOptions, TimescopeTimeLike, TimescopeNumberLike } from 'timescope';
```
