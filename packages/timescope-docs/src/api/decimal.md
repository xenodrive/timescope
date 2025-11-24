# Decimal API

<script setup lang="ts">
import ApiTable from './ApiTable.vue'
</script>

Arbitrary-precision decimal arithmetic type.

## Overview

Timescope uses [`Decimal`](https://www.npmjs.com/package/@kikuchan/decimal) for representing time values, data values, and resolutions with arbitrary precision.
This avoids floating-point arithmetic errors.

The `timescope` package re-exports `Decimal`.

## Constructor

```typescript
Decimal(value: DecimalLike): Decimal
Decimal(value: undefined | null): undefined | null
```

```typescript
import { Decimal } from 'timescope';

const d1 = Decimal(10);
const d2 = Decimal('10.5');
const d3 = Decimal(null);  // Returns null
```

## Arithmetic Operations

<ApiTable :items="[
  { name: 'add(v)', type: 'Decimal', description: 'Addition' },
  { name: 'sub(v)', type: 'Decimal', description: 'Subtraction' },
  { name: 'mul(v)', type: 'Decimal', description: 'Multiplication' },
  { name: 'div(v, digits?)', type: 'Decimal', description: 'Division with precision' },
  { name: 'mod(v)', type: 'Decimal', description: 'Modulo' },
  { name: 'neg()', type: 'Decimal', description: 'Negation' },
  { name: 'abs()', type: 'Decimal', description: 'Absolute value' },
]" />

```typescript
const a = Decimal(10);
const b = Decimal(3);

a.add(b)      // 13
a.sub(b)      // 7
a.mul(b)      // 30
a.div(b, 2)   // 3.33 (2 decimal places)
a.mod(b)      // 1
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

a.gt(b)   // true
a.le(b)   // false
a.eq(10)  // true
a.cmp(b)  // 1
```

## Rounding

<ApiTable :items="[
  { name: 'round(digits?)', type: 'Decimal', description: 'Round to nearest' },
  { name: 'floor(digits?)', type: 'Decimal', description: 'Round down' },
  { name: 'ceil(digits?)', type: 'Decimal', description: 'Round up' },
  { name: 'trunc(digits?)', type: 'Decimal', description: 'Truncate' },
]" />

```typescript
const d = Decimal('3.14159');

d.round(2)  // 3.14
d.floor(2)  // 3.14
d.ceil(2)   // 3.15
d.trunc(2)  // 3.14
```

## Conversion

<ApiTable :items="[
  { name: 'toString()', type: 'string', description: 'Convert to string' },
  { name: 'toFixed(digits)', type: 'string', description: 'Format with fixed decimals' },
  { name: 'number()', type: 'number', description: 'Convert to number (may lose precision)' },
  { name: 'integer()', type: 'bigint', description: 'Convert to integer' },
]" />

```typescript
const d = Decimal('3.14159');

d.toString()    // '3.14159'
d.toFixed(2)    // '3.14'
d.number()      // 3.14159
d.integer()     // 3n
```

## Advanced

<ApiTable :items="[
  { name: 'pow(exp, digits?)', type: 'Decimal', description: 'Power' },
  { name: 'sqrt(digits?)', type: 'Decimal', description: 'Square root' },
  { name: 'root(n, digits?)', type: 'Decimal', description: 'Nth root' },
  { name: 'log(base, digits?)', type: 'Decimal', description: 'Logarithm' },
]" />

```typescript
const d = Decimal(16);

d.pow(2)       // 256
d.sqrt()       // 4
d.root(4)      // 2
d.log(2)       // 4
```

## Utilities

```typescript
Decimal.isDecimal(v)      // Check if value is Decimal
Decimal.pow10(n)          // 10^n as Decimal
Decimal.min(...values)    // Minimum value
Decimal.max(...values)    // Maximum value
Decimal.minmax(...values) // [min, max]
```

## Examples

### Precision Arithmetic

```typescript
const a = Decimal('0.1');
const b = Decimal('0.2');

// Decimal arithmetic
a.add(b).eq('0.3')  // true

// JavaScript floating-point arithmetic
0.1 + 0.2 === 0.3   // false
```

## See Also

- [Timescope API](/api/timescope)
- [Timescope Options](/api/timescope-options)
