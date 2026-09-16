---
titleTemplate: Timescope API
---

# Decimal

<script setup lang="ts">
import ApiTable from './ApiTable.vue'
</script>

Arbitrary-precision decimal arithmetic type.

## Overview

Timescope uses [`Decimal`](https://www.npmjs.com/package/@kikuchan/decimal) for representing time values, data values, and resolutions with arbitrary precision.

The `timescope` package re-exports `Decimal` and the `DecimalLike` type.

## Constructor

```typescript
Decimal(value: DecimalLike): Decimal
Decimal(value: null): null
Decimal(value: undefined): undefined
```

```typescript
import { Decimal } from 'timescope';

const d1 = Decimal(10);
const d2 = Decimal('10.5');
const d3 = Decimal('1.5e2'); // 150
const d4 = Decimal(12345n);
const d5 = Decimal({ coeff: 12345n, digits: 3 }); // 12.345
Decimal(null); // Returns null
Decimal(undefined); // Returns undefined
```

`DecimalLike` accepts a `number`, `string`, `bigint`, existing Decimal instance, or `{ coeff, digits }` object representing `coeff × 10⁻ᵈⁱᵍⁱᵗˢ`.
Use strings or bigints for exact input values.

## Arithmetic Operations

Operations are immutable by default: they return Decimal results without changing the operands. Arithmetic operands accept `DecimalLike` values.

<ApiTable :items="[
  { name: 'add(v)', type: 'Decimal', description: 'Addition' },
  { name: 'sub(v)', type: 'Decimal', description: 'Subtraction' },
  { name: 'mul(v)', type: 'Decimal', description: 'Multiplication' },
  { name: 'div(v, precision?, mode?)', type: 'Decimal', description: 'Exact-first division, or rounding to explicit significant precision' },
  { name: 'divExact(v, fallbackPrecision?, mode?)', type: 'Decimal', description: 'Exact division; non-terminating results require fallback precision' },
  { name: 'divRound(v, digits?, mode?)', type: 'Decimal', description: 'Round the exact quotient to a decimal position (default: 0)' },
  { name: 'divFloor(v, digits?)', type: 'Decimal', description: 'Round the exact quotient toward negative infinity' },
  { name: 'divCeil(v, digits?)', type: 'Decimal', description: 'Round the exact quotient toward positive infinity' },
  { name: 'divTrunc(v, digits?)', type: 'Decimal', description: 'Round the exact quotient toward zero' },
  { name: 'mod(v)', type: 'Decimal', description: 'Remainder with the same sign rules as JavaScript %' },
  { name: 'modPositive(v)', type: 'Decimal', description: 'Non-negative remainder' },
  { name: 'neg()', type: 'Decimal', description: 'Negation' },
  { name: 'abs()', type: 'Decimal', description: 'Absolute value' },
]" />

```typescript
const a = Decimal(10);
const b = Decimal(3);

a.add(b); // 13
a.sub(b); // 7
a.mul(b); // 30
a.div(b, 2); // 3.3 (2 significant digits)
a.divRound(b, 2); // 3.33 (2 decimal places)
a.mod(b); // 1
```

### Significant Precision vs. Decimal Places

`precision` specifies the number of significant digits. `digits` specifies the number of decimal places; negative values round to powers of ten.

Without a precision argument, `div` returns an exact result when possible, or rounds to 18 significant digits.

```typescript
Decimal(12345).div(7, 3).toString(); // '1760' (3 significant digits)
Decimal(12345).divRound(7, 3).toString(); // '1763.571' (3 decimal places)
Decimal(12345).divFloor(7, -2).toString(); // '1700' (whole hundreds)
```

### Mutable Operations

Methods ending in `$` modify the receiver in place and support chaining. Use `clone()` when you need an independent copy before mutating a value.

```typescript
const value = Decimal('1.2345');
const rounded = value.round(2); // 1.23; value remains 1.2345
value.round$(2); // value is now 1.23
value.add$(1).mul$(2); // value is now 4.46
```

## Comparison

<ApiTable :items="[
  { name: 'eq(v)', type: 'boolean', description: 'Equal to' },
  { name: 'neq(v)', type: 'boolean', description: 'Not equal to' },
  { name: 'lt(v)', type: 'boolean', description: 'Less than' },
  { name: 'le(v)', type: 'boolean', description: 'Less than or equal' },
  { name: 'gt(v)', type: 'boolean', description: 'Greater than' },
  { name: 'ge(v)', type: 'boolean', description: 'Greater than or equal' },
  { name: 'cmp(v)', type: 'number', description: 'Compare (-1, 0, 1)' },
]" />

```typescript
const a = Decimal(10);
const b = Decimal(5);

a.gt(b); // true
a.le(b); // false
a.eq(10); // true
a.cmp(b); // 1
```

## Rounding

<ApiTable :items="[
  { name: 'round(digits?)', type: 'Decimal', description: 'Round to nearest, with ties away from zero' },
  { name: 'floor(digits?)', type: 'Decimal', description: 'Round toward negative infinity' },
  { name: 'ceil(digits?)', type: 'Decimal', description: 'Round toward positive infinity' },
  { name: 'trunc(digits?)', type: 'Decimal', description: 'Round toward zero' },
  { name: 'roundBy(step, mode?)', type: 'Decimal', description: 'Round to a multiple of a step size' },
]" />

```typescript
const d = Decimal('3.14159');

d.round(2); // 3.14
d.floor(2); // 3.14
d.ceil(2); // 3.15
d.trunc(2); // 3.14
Decimal('-1.25').round(1); // -1.3
Decimal(1234).round(-2); // 1200
Decimal('12.7').roundBy('0.5'); // 12.5
```

The `digits` argument defaults to `0`. The optional rounding mode for `div`, `divExact`, `divRound`, and `roundBy` is one of:

- `'round'` — nearest, with ties away from zero (default)
- `'floor'` — toward negative infinity
- `'ceil'` — toward positive infinity
- `'trunc'` — toward zero

```typescript
Decimal(1).divRound(3, 2, 'ceil'); // 0.34
```

## Conversion

<ApiTable :items="[
  { name: 'toString()', type: 'string', description: 'Convert to string' },
  { name: 'toFixed(digits)', type: 'string', description: 'Round and format with a fixed number of decimal places' },
  { name: 'number()', type: 'number', description: 'Convert to number (may lose precision)' },
  { name: 'integer()', type: 'bigint', description: 'Convert to integer, truncating toward zero' },
]" />

```typescript
const d = Decimal('3.14159');

d.toString(); // '3.14159'
d.toFixed(2); // '3.14'
d.number(); // 3.14159
d.integer(); // 3n
```

## Advanced

<ApiTable :items="[
  { name: 'pow(exp, precision?)', type: 'Decimal', description: 'Power, including fractional exponents' },
  { name: 'sqrt(precision?)', type: 'Decimal', description: 'Square root' },
  { name: 'root(n, precision?)', type: 'Decimal', description: 'Nth root' },
  { name: 'log(base, precision?)', type: 'Decimal', description: 'Logarithm (default: 18 significant digits)' },
  { name: 'inverse(precision?)', type: 'Decimal', description: 'Reciprocal, using the same precision policy as division' },
]" />

```typescript
const d = Decimal(16);

d.pow(2); // 256
d.sqrt(); // 4
d.root(4); // 2
d.log(2); // 4
```

The optional `precision` argument specifies significant digits. Powers and roots return exact results when possible, or use 18 significant digits by default.

## Utilities

```typescript
Decimal.isDecimal(v); // Check if value is Decimal
Decimal.pow10(n); // 10^n as Decimal
Decimal.min(...values); // Minimum value
Decimal.max(...values); // Maximum value
Decimal.minmax(...values); // [min, max]
```

These utilities are also available as named exports from `@kikuchan/decimal`.

<ApiTable :items="[
  { name: 'isZero() / isPositive() / isNegative()', type: 'boolean', description: 'Test the sign of a value' },
  { name: 'clamp(min, max)', type: 'Decimal', description: 'Limit a value to the given bounds' },
  { name: 'shift10(exponent)', type: 'Decimal', description: 'Multiply by a power of ten' },
  { name: 'rescale()', type: 'Decimal', description: 'Remove trailing fractional zeros' },
  { name: 'clone()', type: 'Decimal', description: 'Create an independent copy' },
]" />

## Examples

### Precision Arithmetic

```typescript
const a = Decimal('0.1');
const b = Decimal('0.2');

// Decimal arithmetic
a.add(b).eq('0.3'); // true

// JavaScript floating-point arithmetic
0.1 + 0.2 === 0.3; // false
```

## See Also

- [@kikuchan/decimal](https://www.npmjs.com/package/@kikuchan/decimal#readme)
- [Calendar](/api/calendar)
- [Timescope API](/api/timescope)
- [Timescope Options](/api/timescope-options)
