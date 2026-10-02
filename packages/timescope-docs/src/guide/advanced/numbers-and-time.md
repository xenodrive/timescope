---
title: Numbers and Calendar Time
---

# Numbers and Calendar Time

Use `Decimal` for precise numeric values and `Calendar` for parsing, formatting, and navigating calendar time.

## Numeric and time inputs

Numeric values accept JavaScript numbers, numeric strings, `bigint`, and `Decimal`. A number has already been rounded to JavaScript's precision before Timescope receives it; use strings or `Decimal` when exact digits matter:

```ts
import { Decimal } from 'timescope';

const value = Decimal('12345678901234567890.123456789');
const next = value.add('0.000000001');
```

`Decimal` also accepts scientific notation and coefficient form, such as `Decimal({ coeff: 123n, digits: 2 })` for `1.23`. The representation is `coeff × 10⁻ᵈⁱᵍⁱᵗˢ`; `digits` is a safe integer and can be negative.

Time inputs treat strings differently: they are calendar date strings parsed by `Calendar`, not numeric strings. Numbers, `bigint`, and `Decimal` use the data's time units, seconds by default. A `Date` converts to Unix epoch seconds.

In navigation settings, `null` follows the clock. An `undefined` range endpoint is unbounded. `TimescopeTimeLike<never>` excludes both nullish values; `TimescopeTimeLike<undefined>` permits `undefined` instead of `null`.

[Input types](/api/types#number-and-time-inputs) · [Time and zoom](/guide/concepts#time-and-zoom)

## Decimal arithmetic

Numeric methods return new values, leaving their receiver unchanged. Their `$` variants mutate the receiver; use non-mutating methods when working with values received from Timescope.

Rounding methods use decimal places, with `0` as the default. Negative places round to powers of ten. `round()` rounds nearest, with ties away from zero; `floor()` rounds toward negative infinity, `ceil()` toward positive infinity, and `trunc()` toward zero. Pass `force: true` as the second argument to preserve the scale, including trailing zeros:

```ts
Decimal('12.345').round(2).toString(); // '12.35'
Decimal('12.3').round(2, true).toString(); // '12.30'
Decimal('1234').round(-2).toString(); // '1200'
```

Methods ending in `By`, such as `roundBy()` and `floorBy()`, round to a multiple of the supplied step instead. `roundBy()` defaults to nearest rounding. `rescale()` sets the decimal scale; without an argument it removes trailing fractional zeros. `toFixed()` formats rounded fixed decimal places, while `number()` can lose precision and `integer()` truncates toward zero.

Division's `precision` counts significant digits, not decimal places, and must be a positive safe integer. `div()` is exact for terminating results when precision is omitted; otherwise it rounds to the requested precision, defaulting to `18`. `divExact()` throws for a non-terminating result unless a fallback precision is supplied. Use `divRound()`, `divFloor()`, `divCeil()`, or `divTrunc()` for decimal-place rounding.

Powers and roots are exact when possible with precision omitted; otherwise they use precision `18`. Fractional exponents are supported. `log()` defaults to precision `18`, and `inverse()` follows the division precision rules.

`mod()` follows JavaScript's remainder sign rules; `modPositive()` gives a nonnegative remainder. `between()` includes both bounds, and `isCloseTo()` compares the absolute difference with a tolerance. `split()` returns the rounded part and remainder, defaulting to `digits: 0` and `mode: 'floor'`; `splitBy()` does the same at step multiples. `neg()` negates by default; pass `false` to leave the sign unchanged.

Static `min()`, `max()`, and `minmax()` ignore `null` and `undefined`, returning `null` for an extremum when no values remain. `Decimal()` itself preserves `null` and `undefined`. Use `isDecimal()` to check for a Decimal value, `isDecimalLike()` for accepted numeric input, or `isDecimalType()` for a Decimal or coefficient/scale object.

[Decimal signatures](/api/classes#decimal)

## Calendar time

`Calendar` works with Unix epoch seconds, including fractional seconds. A no-argument constructor uses the current time; a `Date` input is converted from milliseconds. Component constructors use one-based months and days, with hour, minutes, and seconds defaulting to zero:

```ts
import { Calendar } from 'timescope';

const instant = Calendar.parse('2026-01-15T10:00:00Z');
const utc = instant.utc();
console.log(utc.epoch().toString());
console.log(utc.format('YYYY-MM-DD hh:mm:ssZ'));
```

The initial display zone is `'local'`. Use `'utc'`, `'local'`, or an IANA name such as `'Asia/Tokyo'` with `zone()`. Changing the zone preserves the instant. Component getters read the current zone, with months `1`–`12`, days `1`–`31`, hours `0`–`23`, and minutes `0`–`59`. `weekday()` uses Sunday `0` through Saturday `6`.

Component setters, `epoch(value)`, and zone-changing methods return new instances; their `$` variants change the receiver in place. Calendar factory methods preserve `null` and `undefined`. `fromComponents()` requires integer components except for seconds, which may be fractional; its `zone` determines how the input is interpreted, not the initial display zone.

### Parse and format dates

`Calendar.parse()` uses ISO 8601 when no format is supplied. Its input zone defaults to `'local'`; an explicit offset in the string takes precedence. A custom format requires year and month; omitted components default to day `1` and midnight. Invalid dates throw.

Formatting uses the current display zone. Year widths are minimum widths and never truncate. Astronomical year `0` is 1 BC, `-1` is 2 BC; era-year tokens convert those values to positive era years. Use bracketed text or a backslash escape for literals. Other characters, including fractional separators, are literal.

[Format tokens](/api/classes#calendar-format-tokens)

### Align and step through dates

Use `alignToDay()`, `alignToMonth()`, or `alignToYear()` for a boundary at or before the current date; use the corresponding `next` method for the next boundary. They return new instances in the current zone, at midnight. Their step defaults to `1`; an array specifies boundaries. Year methods accept `{ era: true }` for era-aware alignment. `alignToSecond(step)` aligns to a seconds interval within the day.

[Calendar signatures](/api/classes#calendar)
