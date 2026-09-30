import { Decimal } from '#src/core/decimal';
import { TimescopeYAxis } from '#src/main/layers/TimescopeYAxis';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { describe, expect, it } from 'vitest';

describe('value axis presentation', () => {
  it.each([
    { lower: -0.35, upper: 1.1, labels: ['0.0', '0.4', '0.7', '1.1'] },
    { lower: -1.1, upper: 0.35, labels: ['-1.1', '-0.7', '-0.4', '0.0'] },
    { lower: -1, upper: 1, labels: ['-1.0', '-0.5', '0.0', '0.5', '1.0'] },
  ])('anchors the linear range [$lower, $upper] to evenly spaced ticks', async ({ lower, upper, labels }) => {
    const domain = new TimescopeDomain({ range: [lower, upper], digits: 1, axis: true }, 'signal');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks.map((tick) => tick.text)).toEqual(labels);
      expect(ticks.filter((tick) => tick.zero)).toHaveLength(1);
      const spacing = ticks[1].value - ticks[0].value;
      expect(spacing).toBeGreaterThan(0);
      for (let i = 2; i < ticks.length; i++) {
        expect(ticks[i].value - ticks[i - 1].value).toBeCloseTo(spacing);
      }
      // Zero is one of the evenly spaced ticks, not an additional nearby tick.
      expect(ticks.filter((tick) => tick.text === '0.0')).toHaveLength(1);
    } finally {
      axis.dispose();
    }
  });

  it('keeps logarithmic tick positions and labels distinct in a narrow range at a huge baseline', async () => {
    const lower = Decimal('1e30');
    const upper = lower.add('4e-10');
    const domain = new TimescopeDomain({ range: [lower, upper], scale: 'log', digits: 12, axis: true }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      const ticks = result.data.ticks;
      expect(ticks.length).toBeGreaterThan(1);
      for (const [i, tick] of ticks.entries()) {
        const value = Decimal(tick.text);
        expect(value.ge(lower) && value.le(upper)).toBe(true);
        expect(tick.value).toBeGreaterThanOrEqual(0);
        expect(tick.value).toBeLessThanOrEqual(1);
        if (i > 0) {
          expect(tick.value).toBeGreaterThan(ticks[i - 1].value);
          expect(value.gt(ticks[i - 1].text)).toBe(true);
        }
      }
    } finally {
      axis.dispose();
    }
  });
  it('creates presentation data from its domain state', async () => {
    const domain = new TimescopeDomain(
      {
        range: [0, 100],
        unit: '°C',
        digits: 1,
        axis: { side: 'right', label: 'Temperature', color: '#123456', font: { size: 13, family: 'Inter' } },
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
      font: { size: 13, family: 'Inter' },
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
