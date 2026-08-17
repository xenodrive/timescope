import { Decimal } from '#src/core/decimal';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeYAxis } from '#src/main/TimescopeYAxis';
import { describe, expect, it } from 'vitest';

describe('TimescopeYAxis', () => {
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
    expect(result.data.ticks.map((tick) => tick.text)).toEqual(['0.0', '25.0', '50.0', '75.0', '100.0']);
    expect(result.meta.projection).toBe(domain.createProjection().wire);
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
