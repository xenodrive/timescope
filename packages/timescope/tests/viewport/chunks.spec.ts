import { createChunkList } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { describe, expect, it } from 'vitest';

describe('exact chunk boundaries', () => {
  it.each(['2.99999999999999999999', '-3.00000000000000000001'])('includes the chunk containing %s', (time) => {
    const start = Decimal(time);
    const chunks = createChunkList([start, start.add('1e-20')], Decimal(3), 1);
    const expected = start.isNegative() ? -2n : 0n;
    expect(chunks[0].seq).toBe(expected);
    expect(chunks[0].range[0]!.le(start)).toBe(true);
    expect(chunks[0].range[1]!.gt(start)).toBe(true);
  });

  it('preserves BigInt chunk indices at a huge timestamp and a non-terminating quotient', () => {
    const start = Decimal('1000000000000000000000000000000');
    const chunks = createChunkList([start, start.add(1)], Decimal(3), 1);
    expect(chunks[0].seq).toBe(333333333333333333333333333333n);
    expect(chunks[0].range[0]!.eq(start.sub(1))).toBe(true);
    expect(chunks[0].range[1]!.eq(start.add(2))).toBe(true);
  });
});
