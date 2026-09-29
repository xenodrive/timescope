---
titleTemplate: Timescope API
---

# Decimal

```ts
import { Decimal, type DecimalLike } from 'timescope';
```

Re-export: [`@kikuchan/decimal`](https://www.npmjs.com/package/@kikuchan/decimal).

## Constructor

```ts
Decimal(value: DecimalLike): Decimal
Decimal(value: null): null
Decimal(value: undefined): undefined
```

| `DecimalLike` input                           | Value                                             |
| --------------------------------------------- | ------------------------------------------------- |
| `number`                                      | JavaScript numeric value                          |
| `string`                                      | Exact decimal input; scientific notation accepted |
| `bigint`                                      | Exact integer                                     |
| `Decimal`                                     | Decimal value                                     |
| `{ coeff: bigint, digits: number \| bigint }` | `coeff × 10⁻ᵈⁱᵍⁱᵗˢ`                               |

## Parameters and properties

| Parameter                       | Type                                      | Contract                                                         |
| ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `v`, `step`, `base`, `exponent` | `DecimalLike`                             | Numeric operand                                                  |
| `precision`                     | `number \| bigint`                        | Positive safe integer; significant digits                        |
| `digits`                        | `number \| bigint`                        | Decimal places; negative for powers of ten; rounding default `0` |
| `mode`                          | `'round' \| 'floor' \| 'ceil' \| 'trunc'` | Rounding mode                                                    |

| Property | Type     | Contract                    |
| -------- | -------- | --------------------------- |
| `coeff`  | `bigint` | Signed coefficient          |
| `digits` | `number` | Decimal scale; safe integer |

## Arithmetic Operations

| Method                                   | Returns   | Operation                                                                                                  |
| ---------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `add(v)`                                 | `Decimal` | Addition                                                                                                   |
| `sub(v)`                                 | `Decimal` | Subtraction                                                                                                |
| `mul(v, digits?)`                        | `Decimal` | Multiplication; optional decimal-place rounding                                                            |
| `div(v, precision?, mode?)`              | `Decimal` | Exact when terminating and precision omitted; otherwise significant-digit rounding, default precision `18` |
| `divExact(v, fallbackPrecision?, mode?)` | `Decimal` | Exact quotient; non-terminating result throws without fallback precision                                   |
| `divRound(v, digits?, mode?)`            | `Decimal` | Quotient rounded to decimal places                                                                         |
| `divFloor(v, digits?)`                   | `Decimal` | Quotient rounded toward negative infinity                                                                  |
| `divCeil(v, digits?)`                    | `Decimal` | Quotient rounded toward positive infinity                                                                  |
| `divTrunc(v, digits?)`                   | `Decimal` | Quotient rounded toward zero                                                                               |
| `mod(v)`                                 | `Decimal` | Remainder; JavaScript `%` sign rules                                                                       |
| `modPositive(v)`                         | `Decimal` | Nonnegative remainder                                                                                      |
| `neg(flag?)`                             | `Decimal` | Negation; `flag` defaults to `true`                                                                        |
| `abs()`                                  | `Decimal` | Absolute value                                                                                             |
| `sign()`                                 | `Decimal` | `-1`, `0`, or `1`                                                                                          |

### Mutable Operations

| Form                              | Contract                                          |
| --------------------------------- | ------------------------------------------------- |
| `add(v)`, `round(digits)`, etc.   | Return a result without changing the receiver     |
| `add$(v)`, `round$(digits)`, etc. | Mutate the receiver; numeric operations return it |
| `clone()`                         | Independent copy                                  |

## Comparison

| Method                                     | Returns   | Operation                                            |
| ------------------------------------------ | --------- | ---------------------------------------------------- |
| `eq(v)`, `neq(v)`                          | `boolean` | Equal / unequal                                      |
| `lt(v)`, `le(v)`                           | `boolean` | Less / less or equal                                 |
| `gt(v)`, `ge(v)`                           | `boolean` | Greater / greater or equal                           |
| `cmp(v)`                                   | `number`  | `-1`, `0`, or `1`                                    |
| `between(min, max)`                        | `boolean` | Inclusive bounds; either endpoint may be `undefined` |
| `isCloseTo(v, tolerance)`                  | `boolean` | Absolute difference within tolerance                 |
| `isZero()`, `isPositive()`, `isNegative()` | `boolean` | Sign check                                           |

## Rounding

| Method                                           | Returns   | Operation                                                            |
| ------------------------------------------------ | --------- | -------------------------------------------------------------------- |
| `round(digits?, force?)`                         | `Decimal` | Nearest; ties away from zero                                         |
| `floor(digits?, force?)`                         | `Decimal` | Toward negative infinity                                             |
| `ceil(digits?, force?)`                          | `Decimal` | Toward positive infinity                                             |
| `trunc(digits?, force?)`                         | `Decimal` | Toward zero                                                          |
| `roundBy(step, mode?)`                           | `Decimal` | Round to a step multiple; mode default `'round'`                     |
| `floorBy(step)`, `ceilBy(step)`, `truncBy(step)` | `Decimal` | Directed rounding to a step multiple                                 |
| `rescale(digits?, mode?)`                        | `Decimal` | Set decimal scale; omit `digits` to remove trailing fractional zeros |

`force: true` preserves the requested decimal scale, including trailing zeros.

| Mode      | Direction                                                   |
| --------- | ----------------------------------------------------------- |
| `'round'` | Nearest; ties away from zero; default for division rounding |
| `'floor'` | Negative infinity                                           |
| `'ceil'`  | Positive infinity                                           |
| `'trunc'` | Zero                                                        |

## Conversion

| Method            | Returns  | Contract                                   |
| ----------------- | -------- | ------------------------------------------ |
| `toString()`      | `string` | Decimal string                             |
| `toFixed(digits)` | `string` | Rounded, fixed decimal places              |
| `number()`        | `number` | JavaScript number; possible precision loss |
| `integer()`       | `bigint` | Integer truncated toward zero              |

## Powers and Roots

| Method                                       | Returns   | Operation                            |
| -------------------------------------------- | --------- | ------------------------------------ |
| `pow(exponent, precision?)`                  | `Decimal` | Power; fractional exponents accepted |
| `sqrt(precision?)`                           | `Decimal` | Square root                          |
| `root(degree: number \| bigint, precision?)` | `Decimal` | Nth root                             |
| `log(base, precision?)`                      | `Decimal` | Logarithm; default precision `18`    |
| `inverse(precision?)`                        | `Decimal` | Reciprocal; division precision rules |

Powers and roots: exact when possible with precision omitted; otherwise default precision `18`.

## Utilities

| Method                                | Returns              | Contract                                                       |
| ------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `clamp(min, max)`                     | `Decimal`            | Limit to bounds; either endpoint may be `undefined`            |
| `shift10(exponent: number \| bigint)` | `Decimal`            | Multiply by `10 ** exponent`                                   |
| `order()`                             | `bigint`             | Decimal order of magnitude                                     |
| `frac()`                              | `Decimal`            | Signed fractional part                                         |
| `split(digits?, mode?)`               | `[Decimal, Decimal]` | Rounded part and remainder; default digits `0`, mode `'floor'` |
| `splitBy(step, mode?)`                | `[Decimal, Decimal]` | Step multiple and remainder; default mode `'floor'`            |
| `clone()`                             | `Decimal`            | Independent copy                                               |

| Static method                               | Returns                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `Decimal.isDecimal(value: unknown)`         | `value is Decimal`                                   |
| `Decimal.isDecimalLike(value: unknown)`     | `value is DecimalLike`                               |
| `Decimal.isDecimalType(value: unknown)`     | Type guard for a Decimal or coefficient/scale object |
| `Decimal.pow10(exponent: number \| bigint)` | `Decimal`                                            |
| `Decimal.min(...values)`                    | `Decimal \| null`                                    |
| `Decimal.max(...values)`                    | `Decimal \| null`                                    |
| `Decimal.minmax(...values)`                 | `[Decimal \| null, Decimal \| null]`                 |
| `Decimal.equals(a, b)`                      | `boolean`                                            |

Static min/max/equals inputs: `DecimalLike | null | undefined`; min/max ignore nullish inputs and return `null` when none remain.
