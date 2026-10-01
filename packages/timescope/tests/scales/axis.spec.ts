import { Decimal } from '#src/core/decimal';
import { TimescopeYAxis } from '#src/main/layers/TimescopeYAxis';
import type { TimescopeRoundContext } from '#src/main/round';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { describe, expect, it } from 'vitest';

describe('value axis presentation', () => {
  it.each([
    { range: ['0.125', '0.125'], round: 2 },
    { range: ['1234', '1286'], round: { mode: 'pow10' as const, digits: 1 } },
  ])('does not label a nearby rounded value when no exact tick fits $range', async ({ range, round }) => {
    const domain = new TimescopeDomain({ range: [range[0], range[1]], axis: { round } });
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks).toEqual([]);
      expect(domain.dataRange?.[0].eq(range[0])).toBe(true);
      expect(domain.dataRange?.[1].eq(range[1])).toBe(true);
    } finally {
      axis.dispose();
    }
  });

  it.each([
    { range: ['1234', '1286'], scale: 'linear' as const },
    { range: ['1234', '1286'], scale: 'log' as const },
    { range: ['0.0001', '10000'], scale: 'log' as const },
    { range: ['-1286', '-1234'], scale: 'linear' as const },
    { range: ['-0.04', '0.04'], scale: 'linear' as const },
  ])('positions exponential labels at their exact value for $scale $range', async ({ range, scale }) => {
    const parts: TimescopeRoundContext[] = [];
    const domain = new TimescopeDomain({
      range: [range[0], range[1]],
      scale,
      axis: {
        round: {
          mode: 'pow10',
          digits: 2,
          label: (context) => {
            parts.push(context);
            return `${context.mantissa}e${context.exponent}`;
          },
        },
      },
    });
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      const { projection } = domain.createProjection();
      expect(ticks.length).toBeGreaterThan(0);
      for (const [i, tick] of ticks.entries()) {
        const value = Decimal(tick.text);
        expect(value.ge(range[0]) && value.le(range[1])).toBe(true);
        expect(value.eq(parts[i].value)).toBe(true);
        expect(value.eq(parts[i].roundedValue)).toBe(true);
        expect(tick.value).toBe(projection.normalize(value));
        if (i > 0) expect(value.gt(ticks[i - 1].text)).toBe(true);
      }
    } finally {
      axis.dispose();
    }
  });

  it.each([
    { range: ['0', '0.04'], scale: 'linear' as const, labels: ['0.00', '0.01', '0.02', '0.03', '0.04'] },
    { range: ['0', '1000'], scale: 'linear' as const, labels: ['0', '200', '400', '600', '800', '1000'] },
    { range: ['0.01', '0.5'], scale: 'log' as const, labels: ['0.01', '0.02', '0.05', '0.10', '0.20', '0.50'] },
    { range: ['0.00125', '0.00125'], scale: 'linear' as const, labels: ['0.00125'] },
  ])('automatically aligns decimal places for $scale range $range', async ({ range, scale, labels }) => {
    const domain = new TimescopeDomain({ range: [range[0], range[1]], scale, axis: true }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(result.data.ticks.map((tick) => tick.text)).toEqual(labels);
    } finally {
      axis.dispose();
    }
  });

  it.each([
    { axisDigits: 0, labels: ['0', '1'] },
    { axisDigits: 2, labels: ['0.00', '0.20', '0.40', '0.60', '0.80', '1.00'] },
    { axisDigits: undefined, labels: ['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'] },
  ])('uses axis round $axisDigits independently of the domain', async ({ axisDigits, labels }) => {
    const domain = new TimescopeDomain({ range: [0, 1], axis: { round: axisDigits } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(result.data.ticks.map((tick) => tick.text)).toEqual(labels);
    } finally {
      axis.dispose();
    }
  });

  it.each([
    { lower: -0.35, upper: 1.1, labels: ['-0.2', '0.0', '0.2', '0.4', '0.6', '0.8', '1.0'] },
    { lower: -1.1, upper: 0.35, labels: ['-1.0', '-0.8', '-0.6', '-0.4', '-0.2', '0.0', '0.2'] },
    { lower: -1, upper: 1, labels: ['-1.0', '-0.5', '0.0', '0.5', '1.0'] },
  ])('anchors the linear range [$lower, $upper] to evenly spaced ticks', async ({ lower, upper, labels }) => {
    const domain = new TimescopeDomain({ range: [lower, upper], axis: { round: 1 } }, 'signal');
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

  it.each([
    { lower: 11, upper: 29, labels: ['15', '20', '25'] },
    { lower: -29, upper: -11, labels: ['-25', '-20', '-15'] },
    { lower: -0.35, upper: 1.1, labels: ['0', '1'] },
  ])('uses round ticks inside [$lower, $upper] without expanding the range', async ({ lower, upper, labels }) => {
    const domain = new TimescopeDomain({ range: [lower, upper], axis: { round: 0 } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(result.data.ticks.map((tick) => tick.text)).toEqual(labels);
      expect(domain.dataRange?.[0].eq(lower)).toBe(true);
      expect(domain.dataRange?.[1].eq(upper)).toBe(true);
    } finally {
      axis.dispose();
    }
  });

  it('limits tick density to the configured decimal precision without merging labels', async () => {
    const domain = new TimescopeDomain({ range: [-0.04, 0.04], axis: { round: 1 } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const result = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(result.data.ticks).toMatchObject([{ text: '0.0', zero: true }]);
      expect(result.data.ticks).toHaveLength(1);
    } finally {
      axis.dispose();
    }
  });

  it.each([undefined, 12])('keeps linear nice ticks exact at a huge baseline with digits=%s', async (digits) => {
    const baseline = Decimal('1e30');
    const lower = baseline.add('1.5e-10');
    const upper = baseline.add('5.5e-10');
    const domain = new TimescopeDomain({ range: [lower, upper], axis: { round: digits } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks.map((tick) => tick.text)).toEqual(
        [2, 3, 4, 5].map((i) => baseline.add(Decimal(i).shift10(-10)).toFixed(digits ?? 10)),
      );
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].value).toBeGreaterThan(ticks[i - 1].value);
      }
    } finally {
      axis.dispose();
    }
  });

  it.each([
    { lower: '1', upper: '10000', digits: 0, labels: ['1', '10', '100', '1000', '10000'] },
    { lower: '1', upper: '1000', digits: 0, labels: ['1', '10', '100', '1000'] },
    { lower: '1', upper: '50', digits: 0, labels: ['1', '2', '5', '10', '20', '50'] },
    { lower: '0.1', upper: '5', digits: 1, labels: ['0.1', '0.2', '0.5', '1.0', '2.0', '5.0'] },
    { lower: '11', upper: '29', digits: 0, labels: ['15', '20', '25'] },
    { lower: '0.01', upper: '0.5', digits: 1, labels: ['0.1', '0.2', '0.5'] },
  ])('chooses round logarithmic ticks for [$lower, $upper]', async ({ lower, upper, digits, labels }) => {
    const domain = new TimescopeDomain({ range: [lower, upper], scale: 'log', axis: { round: digits } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks.map((tick) => tick.text)).toEqual(labels);
      const logLower = Math.log10(Number(lower));
      const logSpan = Math.log10(Number(upper)) - logLower;
      for (const tick of ticks) {
        expect(tick.value).toBeCloseTo((Math.log10(Number(tick.text)) - logLower) / logSpan, 12);
        expect(Decimal(tick.text).ge(lower) && Decimal(tick.text).le(upper)).toBe(true);
      }
      expect(domain.dataRange?.[0].eq(lower)).toBe(true);
      expect(domain.dataRange?.[1].eq(upper)).toBe(true);
    } finally {
      axis.dispose();
    }
  });

  it('samples exponent strides across a thousand decades', async () => {
    const domain = new TimescopeDomain({ range: ['1', '1e1000'], scale: 'log', axis: { round: 0 } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks.map((tick) => Decimal(tick.text).order())).toEqual([0n, 200n, 400n, 600n, 800n, 1000n]);
      for (const [i, tick] of ticks.entries()) expect(tick.value).toBeCloseTo(i / 5, 12);
    } finally {
      axis.dispose();
    }
  });

  it('anchors exponent strides across negative and positive decades', async () => {
    const domain = new TimescopeDomain({ range: ['1e-12', '1e12'], scale: 'log', axis: { round: 12 } }, 'value');
    domain.recompute();
    const axis = new TimescopeYAxis({ domain });
    try {
      const {
        data: { ticks },
      } = await axis.loadData([Decimal(0), Decimal(1)], Decimal(1));
      expect(ticks.map((tick) => Decimal(tick.text).order())).toEqual([-10n, -5n, 0n, 5n, 10n]);
    } finally {
      axis.dispose();
    }
  });

  it.each([undefined, 12])('keeps logarithmic ticks distinct at a huge baseline with digits=%s', async (digits) => {
    const lower = Decimal('1e30');
    const upper = lower.add('4e-10');
    const domain = new TimescopeDomain({ range: [lower, upper], scale: 'log', axis: { round: digits } }, 'value');
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
        axis: { round: 1, side: 'right', label: 'Temperature', color: '#123456', font: { size: 13, family: 'Inter' } },
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
