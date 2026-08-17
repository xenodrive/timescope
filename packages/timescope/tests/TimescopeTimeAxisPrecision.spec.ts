import { Decimal } from '#src/core/decimal';
import { TimescopeViewport } from '#src/worker/TimescopeViewport';
import { describe, expect, it } from 'vitest';

describe('TimescopeViewport coordinate precision', () => {
  it('converts to double only after Decimal time projection', () => {
    const center = Decimal('100000000000000000000000000000000000000000000000000');
    const axis = new TimescopeViewport({ time: center, timeRange: [undefined, undefined], zoom: 100 });
    const resolution = axis.r(Decimal(100));
    const onePixel = center.add(resolution);
    const quarterPixel = center.add(resolution.mul('0.25'));
    axis.setAxisLength([400, 400]);

    expect(axis.p(center)).toBe(400);
    expect(axis.p(quarterPixel)).toBe(400.25);
    expect(axis.p(onePixel)).toBe(401);
    expect(axis.t(401).eq(onePixel)).toBe(true);
  });
});
