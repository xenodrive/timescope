import { Decimal } from '#src/core/decimal';
import { TimescopeYAxis } from '#src/main/loaders/TimescopeYAxis';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { describe, expect, it } from 'vitest';

describe('value axis presentation', () => {
  it('creates presentation data from its domain state', async () => {
    const domain = new TimescopeDomain(
      {
        range: [0, 100],
        unit: '°C',
        digits: 1,
        axis: { side: 'right', label: 'Temperature', color: '#123456' },
      },
      'temperature',
    );
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });

    const result = await axis.loadData([Decimal(0), Decimal(10)], Decimal(1));

    expect(result.data).toMatchObject({
      id: domain.uid,
      side: 'right',
      label: 'Temperature',
      unit: '°C',
      color: '#123456',
    });
    expect(result.data.ticks.length).toBeGreaterThan(0);
    for (const tick of result.data.ticks) {
      expect(tick.text).toMatch(/^\d+\.\d$/);
      expect(Number(tick.text)).toBeGreaterThanOrEqual(0);
      expect(Number(tick.text)).toBeLessThanOrEqual(100);
    }
  });

  it('uses the domain name and default side for shorthand axis options', async () => {
    const domain = new TimescopeDomain({ range: [0, 1], axis: true }, 'value');
    domain.recompute();
    const result = await new TimescopeYAxis({ domain }).loadData([Decimal(0), Decimal(1)], Decimal(1));

    expect(result.data.side).toBe('left');
    expect(result.data.label).toBe('value');
    expect(result.data.color).toBeUndefined();
  });

  it('uses the latest inline domain name as its default label', async () => {
    const domain = new TimescopeDomain({ range: [0, 1], axis: true }, 'before');
    domain.updateOptions({ range: [0, 1], axis: true }, 'after');
    const result = await new TimescopeYAxis({ domain }).loadData([Decimal(0), Decimal(1)], Decimal(1));

    expect(result.data.label).toBe('after');
  });
});
