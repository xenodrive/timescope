---
titleTemplate: Timescope API
---

# Calendar

```ts
import { Calendar } from 'timescope';
```

`Calendar` represents an instant as arbitrary-precision Unix epoch seconds and provides calendar components, time-zone conversions, formatting, and calendar-boundary alignment. Timescope uses it to parse date strings and generate calendar time-axis ticks.

Timescope re-exports `Calendar` from [`@kikuchan/calendar`](https://www.npmjs.com/package/@kikuchan/calendar), rather than providing a separate implementation. Use `Calendar.fromEpoch()` to turn a concrete Timescope time into a calendar date, and `.epoch()` to pass that date back to Timescope as a [`Decimal`](/api/decimal). Numeric epoch inputs use seconds, not JavaScript `Date`'s milliseconds.

## Constructor

```ts
new Calendar()
new Calendar(epochSeconds: DecimalLike | Date)
new Calendar(year: bigint | number, month: bigint | number, day: bigint | number,
  hour?: bigint | number, minutes?: bigint | number, seconds?: DecimalLike)
```

| Input / default                  | Contract                                   |
| -------------------------------- | ------------------------------------------ |
| No arguments                     | Current time                               |
| Numeric epoch                    | Unix epoch **seconds**                     |
| `Date`                           | JavaScript date converted to epoch seconds |
| Month / day                      | One-based                                  |
| Omitted hour / minutes / seconds | `0`                                        |
| Initial display zone             | `'local'`                                  |

### Factory Methods

| Method                                                               | Returns    | Contract                                                                 |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `Calendar.fromEpoch(epochSeconds: DecimalLike)`                      | `Calendar` | Unix epoch seconds                                                       |
| `Calendar.fromDate(date: Date)`                                      | `Calendar` | JavaScript date                                                          |
| `Calendar.fromComponents(input)`                                     | `Calendar` | Components interpreted in `input.zone`; display zone initially `'local'` |
| `Calendar.parse(value: string, format?: string, inputZone?: string)` | `Calendar` | ISO 8601 if format omitted; input zone default `'local'`                 |

All four factories preserve `null` and `undefined` inputs.

| `fromComponents` field | Type          | Default                          |
| ---------------------- | ------------- | -------------------------------- |
| `year`, `month`, `day` | `DecimalLike` | Required; integer components     |
| `hour`, `minutes`      | `DecimalLike` | `0`; integer components          |
| `seconds`              | `DecimalLike` | `0`; fractional seconds accepted |
| `zone`                 | `string`      | `'local'`                        |

## Components and Epoch

| Getter         | Returns                                                                                                          | Range / unit                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `year()`       | `bigint`                                                                                                         | Astronomical year; `0` = 1 BC |
| `month()`      | `bigint`                                                                                                         | `1`–`12`                      |
| `day()`        | `bigint`                                                                                                         | `1`–`31`                      |
| `hour()`       | `bigint`                                                                                                         | `0`–`23`                      |
| `minutes()`    | `bigint`                                                                                                         | `0`–`59`                      |
| `seconds()`    | `Decimal`                                                                                                        | Fractional seconds            |
| `weekday()`    | `number`                                                                                                         | `0` = Sunday … `6` = Saturday |
| `epoch()`      | `Decimal`                                                                                                        | Unix epoch seconds            |
| `components()` | `{ year: bigint, month: bigint, day: bigint, hour: bigint, minutes: bigint, seconds: Decimal, weekday: number }` | Current-zone components       |
| `clone()`      | `Calendar`                                                                                                       | Independent copy              |

| Setter                                                                                               | Returns    | Mutation                                  |
| ---------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| `year(value)`, `month(value)`, `day(value)`, `hour(value)`, `minutes(value)`, `seconds(value)`       | `Calendar` | New instance; values accept `DecimalLike` |
| `year$(value)`, `month$(value)`, `day$(value)`, `hour$(value)`, `minutes$(value)`, `seconds$(value)` | `Calendar` | In place                                  |
| `epoch(value: DecimalLike)`                                                                          | `Calendar` | New instance                              |
| `epoch$(value: DecimalLike)`                                                                         | `this`     | In place                                  |

## Time Zones

| Method                               | Returns    | Contract                                      |
| ------------------------------------ | ---------- | --------------------------------------------- |
| `zone()`                             | `string`   | Current zone                                  |
| `zone(value: string)`                | `Calendar` | Copy in the specified zone; instant preserved |
| `utc()`                              | `Calendar` | Copy in UTC                                   |
| `local()`                            | `Calendar` | Copy in the local system zone                 |
| `zone$(value)`, `utc$()`, `local$()` | `this`     | Change zone in place; instant preserved       |

Accepted zones: `'utc'`, `'local'`, IANA names such as `'Asia/Tokyo'`.

## Alignment and Stepping

| Method                             | Returns    | Contract                                     |
| ---------------------------------- | ---------- | -------------------------------------------- |
| `alignToDay(step?)`                | `Calendar` | Day boundary at or before the current date   |
| `nextDay(step?)`                   | `Calendar` | Next day boundary                            |
| `alignToMonth(step?)`              | `Calendar` | Month boundary at or before the current date |
| `nextMonth(step?)`                 | `Calendar` | Next month boundary                          |
| `alignToYear(step?, options?)`     | `Calendar` | Year boundary at or before the current date  |
| `nextYear(step?, options?)`        | `Calendar` | Next year boundary                           |
| `alignToSecond(step: DecimalLike)` | `Calendar` | Seconds interval within the day              |

| Parameter / result        | Contract                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Day / month / year `step` | `number \| bigint \| (number \| bigint)[]`; default `1`; arrays specify boundaries |
| Year `options`            | `{ era?: boolean }`; era-aware alignment                                           |
| Result                    | New instance in the current zone                                                   |
| Day / month / year time   | Reset to midnight                                                                  |

## Formatting and Parsing

| Signature                                                            | Returns    | Contract                                                |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `format(format: string)`                                             | `string`   | Format in the current zone                              |
| `Calendar.parse(value: string, format?: string, inputZone?: string)` | `Calendar` | Explicit input offset takes precedence over `inputZone` |

| Token                       | Parsing                                           | Formatting                                                            |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `Y` / `y`, repeated n times | Optional sign and one or more digits              | At least n digits; negative sign only                                 |
| `IY`                        | Same as `Y`                                       | Four digits for years 0–9999; otherwise sign and at least six digits  |
| `G`, repeated n times       | Positive era year with `BC` prefix or `AD` suffix | At least n digits with `BC` prefix or `AD` suffix                     |
| `g`, repeated n times       | Positive era year with optional `BC` prefix       | At least n digits; `BC` prefix before AD 1                            |
| `MM` / `M`                  | 1–2 digit month                                   | Two digits / no padding                                               |
| `DD`                        | 1–2 digit day                                     | Two digits                                                            |
| `hh` / `h`                  | 1–2 digit 24-hour time                            | Two digits / no padding                                               |
| `mm`                        | 1–2 digit minute                                  | Two digits                                                            |
| `ss`                        | 1–2 digit whole second                            | Two digits                                                            |
| `S`, repeated n times       | 1–n fractional digits                             | Exactly n digits, padded or truncated                                 |
| `S*`                        | One or more fractional digits                     | All fractional digits without trailing zeros; `0` for integer seconds |
| `Z`                         | `Z`, `±HH:mm`, or `±HHmm`                         | `Z` for zero offset, otherwise `±HH:mm`                               |
| `[text]`                    | Literal text                                      | Literal text                                                          |
| Backslash + character       | Literal next character                            | Literal next character                                                |

| Rule                           | Contract                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| Year width                     | Never truncates; `YY` formats 2026 as `2026`; `YYYY` and `yyyy` equivalent |
| Fractional separator           | Literal; `.S*` requires at least one fractional digit                      |
| Required parse tokens          | Year and month                                                             |
| Missing lower-order components | Day `1`, time `00:00:00`                                                   |
| Invalid calendar ranges        | Throw an error                                                             |
| Era numbering                  | 1 BC → year `0`; 2 BC → year `-1`                                          |
| Non-token characters           | Literal                                                                    |
