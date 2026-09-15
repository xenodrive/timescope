import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { describe, expect, it, vi } from 'vitest';

function createSeries() {
  return {} as TimescopeDataSeries;
}

function decimalRange(range: [number, number] | null): TimescopeRange<Decimal> | null {
  return range ? (range.map(Decimal) as TimescopeRange<Decimal>) : null;
}

function report(
  domain: TimescopeDomain,
  series: TimescopeDataSeries,
  extent: [number, number] | null,
  positiveExtent: [number, number] | null = extent,
) {
  domain.reportExtent(series, decimalRange(extent), decimalRange(positiveExtent));
}

function values(domain: TimescopeDomain) {
  return domain.dataRange?.map((value) => value.number()) ?? null;
}

describe('shared value domain', () => {
  it('uses reported chart extents and shrinks by default', () => {
    const domain = new TimescopeDomain();
    const series = createSeries();
    domain.addSeries(series);

    report(domain, series, [10, 20]);
    expect(values(domain)).toEqual([10, 20]);

    report(domain, series, [12, 15]);
    expect(values(domain)).toEqual([12, 15]);
  });

  it('stays empty until a chart reports an extent', () => {
    const domain = new TimescopeDomain();
    domain.addSeries(createSeries());
    expect(values(domain)).toBeNull();
    expect(domain.createProjection().wire.mode).toBe('empty');
  });

  it('stays empty until a chart completes a partially specified range', () => {
    const domain = new TimescopeDomain({ range: [0, undefined] });
    const series = createSeries();
    domain.addSeries(series);

    expect(values(domain)).toBeNull();
    expect(domain.createProjection().wire.mode).toBe('empty');

    report(domain, series, [10, 20]);
    expect(values(domain)).toEqual([0, 20]);
  });

  it('preserves negative numeric lower and upper semantics', () => {
    const domain = new TimescopeDomain();
    const series = createSeries();
    domain.addSeries(series);
    report(domain, series, [-20, -10], null);
    expect(values(domain)).toEqual([-20, -10]);
  });

  it('honors fixed and expanding bounds', () => {
    const fixedLower = new TimescopeDomain({ range: [0, undefined] });
    const fixedSeries = createSeries();
    fixedLower.addSeries(fixedSeries);
    report(fixedLower, fixedSeries, [10, 20]);
    expect(values(fixedLower)).toEqual([0, 20]);

    const expanding = new TimescopeDomain({ range: [0, 10], expand: true });
    const expandingSeries = createSeries();
    expanding.addSeries(expandingSeries);
    report(expanding, expandingSeries, [-5, 20]);
    expect(values(expanding)).toEqual([-5, 20]);
  });

  it('does not require a chart report for a fixed range', () => {
    const domain = new TimescopeDomain({ range: [-1, 1] });
    domain.addSeries(createSeries());
    expect(values(domain)).toEqual([-1, 1]);
  });

  it('returns to an empty range when a chart becomes empty', () => {
    const domain = new TimescopeDomain();
    const series = createSeries();
    domain.addSeries(series);
    report(domain, series, [1, 2]);
    report(domain, series, null);
    expect(values(domain)).toBeNull();
  });

  it('uses positive chart extents for a logarithmic range', () => {
    const domain = new TimescopeDomain({ scale: 'log' });
    const series = createSeries();
    domain.addSeries(series);
    report(domain, series, [-5, 10], [1, 10]);
    expect(values(domain)).toEqual([1, 10]);
  });

  it('does not carry a nonpositive range into a logarithmic scale', () => {
    const domain = new TimescopeDomain();
    const series = createSeries();
    domain.addSeries(series);
    report(domain, series, [-10, -5], null);
    domain.updateOptions({ scale: 'log', shrink: false });
    expect(values(domain)).toBeNull();
    expect(domain.createProjection().wire.mode).toBe('empty');
  });

  it('merges reports from series sharing a domain', () => {
    const domain = new TimescopeDomain();
    const first = createSeries();
    const second = createSeries();
    domain.addSeries(first);
    domain.addSeries(second);
    report(domain, first, [0, 10]);
    report(domain, second, [20, 30]);
    expect(values(domain)).toEqual([0, 30]);

    report(domain, first, [5, 15]);
    report(domain, second, [25, 40]);
    expect(values(domain)).toEqual([5, 40]);
  });

  it('removes a disposed series report', () => {
    const domain = new TimescopeDomain();
    const first = createSeries();
    const second = createSeries();
    domain.addSeries(first);
    domain.addSeries(second);
    report(domain, first, [0, 10]);
    report(domain, second, [20, 30]);

    domain.removeSeries(second);
    expect(values(domain)).toEqual([0, 10]);
  });

  it('does not emit a change for an identical report', () => {
    const domain = new TimescopeDomain();
    const series = createSeries();
    domain.addSeries(series);
    report(domain, series, [1, 2]);
    const changed = vi.fn();
    domain.on('change', changed);

    report(domain, series, [1, 2]);
    expect(changed).not.toHaveBeenCalled();
  });
});
