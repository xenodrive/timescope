---
titleTemplate: Timescope API
---
# Calendar

<script setup lang="ts">
import ApiTable from './ApiTable.vue'
</script>

Arbitrary-precision date and time type.

## Overview

Timescope re-exports [`Calendar`](https://www.npmjs.com/package/@kikuchan/calendar), a date and time library built on [Decimal](/api/decimal).
It converts between calendar components and Unix epoch seconds while preserving fractional-second precision, and supports time zones, formatting, and calendar alignment.

Epoch values are in **seconds**, unlike JavaScript `Date` timestamps, which are in milliseconds. Use `epoch()` to obtain a `Decimal` time value for Timescope.

## Constructor

```typescript
new Calendar()
new Calendar(epochSeconds: DecimalLike | Date)
new Calendar(year: bigint | number, month: bigint | number, day: bigint | number,
  hour?: bigint | number, minutes?: bigint | number, seconds?: DecimalLike)
```

The default time zone is `'local'`. The no-argument constructor uses the current time. Months are numbered from 1 to 12, and days from 1.

```typescript
import { Calendar } from 'timescope';

const now = new Calendar();
const date = new Calendar(2024, 6, 15, 12, 30, '45.123456789');
const time = date.epoch(); // Decimal Unix epoch seconds
```

### Factory Methods

<ApiTable :items="[
  { name: 'Calendar.fromEpoch(epochSeconds)', type: 'Calendar', description: 'Create from Unix epoch seconds (DecimalLike)' },
  { name: 'Calendar.fromDate(date)', type: 'Calendar', description: 'Create from a JavaScript Date' },
  { name: 'Calendar.fromComponents(input)', type: 'Calendar', description: 'Create from year, month, day, and optional hour, minutes, seconds, zone' },
  { name: 'Calendar.parse(value, format?, inputZone?)', type: 'Calendar', description: 'Parse ISO 8601 or a string in the specified format' },
]" />

```typescript
const date = Calendar.fromComponents({
  year: 2024,
  month: 6,
  day: 15,
  hour: 12,
  minutes: 30,
  seconds: '45.123456789',
  zone: 'utc',
}).utc();

const epoch = Calendar.fromEpoch('12.3456789').utc();
epoch.seconds().toString(); // '12.3456789'
```

## Components and Epoch

<ApiTable :items="[
  { name: 'year()', type: 'bigint', description: 'Year' },
  { name: 'month()', type: 'bigint', description: 'Month (1–12)' },
  { name: 'day()', type: 'bigint', description: 'Day of the month (1–31)' },
  { name: 'hour()', type: 'bigint', description: 'Hour (0–23)' },
  { name: 'minutes()', type: 'bigint', description: 'Minutes (0–59)' },
  { name: 'seconds()', type: 'Decimal', description: 'Seconds, including the fractional part' },
  { name: 'weekday()', type: 'number', description: 'Day of the week (0 = Sunday, 6 = Saturday)' },
  { name: 'components()', type: '{ year: bigint; month: bigint; day: bigint; hour: bigint; minutes: bigint; seconds: Decimal; weekday: number }', description: 'Object containing all of the above components' },
  { name: 'epoch()', type: 'Decimal', description: 'Unix epoch seconds' },
  { name: 'clone()', type: 'Calendar', description: 'Create an independent copy' },
]" />

Component methods other than `weekday()` also accept a value to set that component. Setters and alignment operations return a new instance. Methods ending in `$` modify the instance in place.

```typescript
const date = new Calendar(2024, 6, 15);

date.year();                     // 2024n
date.month(12).day(31);           // New Calendar for December 31
date.year();                     // Still 2024n
date.year$(2025).seconds$('0.5'); // Modify date in place

date.epoch('0');  // New Calendar at the Unix epoch
date.epoch$('0'); // Modify date in place
```

## Time Zones

Supported zones include `'utc'`, `'local'`, and IANA names such as `'Asia/Tokyo'` or `'America/New_York'`.
Changing the zone preserves the instant and changes its calendar representation.
Constructors and factories return instances in `'local'`. To interpret components in another time zone, specify `zone` in `fromComponents(input)`; use `.zone(...)` or `.utc()` to select the display and calendar-operation time zone.

<ApiTable :items="[
  { name: 'zone()', type: 'string', description: 'Get the current time zone' },
  { name: 'zone(value)', type: 'Calendar', description: 'Return a copy in the specified time zone' },
  { name: 'utc()', type: 'Calendar', description: 'Return a copy in UTC' },
  { name: 'local()', type: 'Calendar', description: 'Return a copy in the local system time zone' },
  { name: 'zone$(value), utc$(), local$()', type: 'this', description: 'Change the time zone in place' },
]" />

```typescript
const date = Calendar.fromEpoch(0).utc();
date.zone('Asia/Tokyo').format('YYYY-MM-DD hh:mm:ss'); // '1970-01-01 09:00:00'
```

## Alignment and Stepping

Align to calendar boundaries or advance to the next boundary. Day, month, and year operations reset the time to midnight.

<ApiTable :items="[
  { name: 'alignToDay(step?)', type: 'Calendar', description: 'Align to a day boundary at or before the current date' },
  { name: 'nextDay(step?)', type: 'Calendar', description: 'Advance to the next day boundary' },
  { name: 'alignToMonth(step?)', type: 'Calendar', description: 'Align to a month boundary' },
  { name: 'nextMonth(step?)', type: 'Calendar', description: 'Advance to the next month boundary' },
  { name: 'alignToYear(step?, options?)', type: 'Calendar', description: 'Align to a year boundary; supports { era: true } for era-aware alignment' },
  { name: 'nextYear(step?, options?)', type: 'Calendar', description: 'Advance to the next year boundary; supports { era: true }' },
  { name: 'alignToSecond(step)', type: 'Calendar', description: 'Align to a DecimalLike seconds interval within the day' },
]" />

For day, month, and year operations, `step` can be a `number`, `bigint`, or an array of those values specifying boundaries. Omitting it uses a step of 1.

```typescript
const date = Calendar.fromComponents({ year: 2024, month: 6, day: 17, hour: 10, minutes: 30, zone: 'utc' }).utc();

date.alignToDay().format('YYYY-MM-DD hh:mm:ss'); // '2024-06-17 00:00:00'
date.alignToDay([1, 15]).format('YYYY-MM-DD');    // '2024-06-15'
date.nextDay([1, 15]).format('YYYY-MM-DD');       // '2024-07-01'
date.alignToMonth(3).format('YYYY-MM-DD');       // '2024-04-01'
date.nextMonth(3).format('YYYY-MM-DD');          // '2024-07-01'
date.alignToSecond(300);                        // Align to a 5-minute interval
```

## Formatting and Parsing

Use `format(fmt)` to produce a string and `Calendar.parse(value, format?, inputZone?)` to read one. Omitting `format` accepts ISO 8601. `inputZone` defaults to `'local'` and applies to input without an explicit offset.

```typescript
const date = Calendar.fromEpoch('12.3456').utc();
date.format('YYYY-MM-DD hh:mm:ss.SSSSSS'); // '1970-01-01 00:00:12.345600'
date.format('IY-MM-DD[T]hh:mm:ss.S*Z');    // '1970-01-01T00:00:12.3456Z'

const parsed = Calendar.parse('2024-06-15 12:30:45.123', 'YYYY-MM-DD hh:mm:ss.SSS', 'utc').utc();
parsed.seconds().toString(); // '45.123'
```

| Token | Parsing | Formatting |
| --- | --- | --- |
| `Y` / `y`, repeated n times | Optional `+` / `-`, followed by one or more digits | At least n digits, excluding the sign; negative sign only |
| `IY` | Same as `Y` | Four digits for years 0–9999; otherwise a sign and at least six digits |
| `G`, repeated n times | Positive era year with a `BC` prefix or `AD` suffix | At least n digits, with a `BC` prefix or `AD` suffix |
| `g`, repeated n times | Positive era year with an optional `BC` prefix | At least n digits; `BC` prefix only for years before AD 1 |
| `MM` / `M` | 1–2 digit month | Two digits / no padding |
| `DD` | 1–2 digit day | Two digits |
| `hh` / `h` | 1–2 digit hour (24-hour clock) | Two digits / no padding |
| `mm` | 1–2 digit minute | Two digits |
| `ss` | 1–2 digit whole second | Two digits |
| `S`, repeated n times | 1–n fractional digits | Exactly n digits, zero-padded or truncated |
| `S*` | One or more fractional digits, with no upper limit | All fractional digits without trailing zeros; `0` for integer seconds |
| `Z` | `Z`, `±HH:mm`, or `±HHmm` | `Z` for zero offset; otherwise `±HH:mm` |

Year widths never truncate: `YY` formats year 2026 as `2026`. All year widths accept shorter inputs, and `YYYY` and `yyyy` are aliases.
The decimal point is literal: `.S*` requires at least one fractional digit when parsing.

Parsing requires year and month tokens. Missing lower-order components default to the start of the period (day 1 and time 00:00:00). Invalid calendar ranges throw an error.
Era tokens map 1 BC to year `0`, 2 BC to year `-1`, and so on.

Wrap text in `[...]` to treat it as a literal, or use a backslash to escape the next character. This applies to both parsing and formatting: `[T]` represents `T`, and `[Z]` represents a literal `Z` rather than an offset. Characters that are not tokens remain literal.

## See Also

- [Decimal](/api/decimal)
- [Timescope API](/api/timescope)
- [Timescope Options](/api/timescope-options)
