import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeTimeAxis } from '#src/main/loaders/TimescopeTimeAxis';
import type { TimescopeTimeAxisOptions } from '#src/main/options';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import { describe, expect, it } from 'vitest';

async function ticks(start: string, end: string, resolution: number, options: TimescopeTimeAxisOptions) {
  const range: TimescopeRange<Decimal> = [Decimal(Date.parse(start) / 1000), Decimal(Date.parse(end) / 1000)];
  const r = Decimal(resolution);
  return (await ticksInRange(range, r, options)).filter((tick) => tick.major);
}

async function ticksInRange(range: TimescopeRange<Decimal>, r: Decimal, options: TimescopeTimeAxisOptions) {
  const center = range[0].add(range[1]).divExact(2);
  const halfWidth = range[1].sub(range[0]).div(r).div(2).number();
  const context = new TimescopeViewRegistry();
  const axis = new TimescopeTimeAxis({ timeAxis: options, viewContext: context });
  try {
    context.update({
      current: { center, resolution: r },
      candidate: { center, resolution: r },
      cursor: { center },
      axisSize: [halfWidth, halfWidth],
      editing: false,
      animating: false,
      phase: 'changed',
    });
    await axis.waitForTarget();
    const result = await axis.loadData(range, r);
    return result.data;
  } finally {
    axis.dispose();
  }
}

describe('time-axis timezone', () => {
  it.each(['1e-20', '1', '1e20'])('creates exact relative tick steps at resolution %s', async (resolution) => {
    const r = Decimal(resolution);
    const result = await ticksInRange([Decimal(0), r.mul(400)], r, { relative: true });
    expect(result.length).toBeGreaterThan(1);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].time.time.gt(result[i - 1].time.time)).toBe(true);
    }
    expect(result.some((tick) => tick.time.time.eq(0))).toBe(true);
  });

  it('keeps tiny relative ticks at a huge absolute timestamp', async () => {
    const base = Decimal('1e30');
    const result = await ticksInRange([base.sub('1e-30'), base.add('2e-18')], Decimal('3e-20'), { relative: true });
    expect(result).toHaveLength(2);
    expect(result[0].time.time.eq(base)).toBe(true);
    expect(result[1].time.time.eq(base.add('1e-18'))).toBe(true);
  });

  it('keeps simultaneous UTC and Tokyo axes independent', async () => {
    const [utc, tokyo] = await Promise.all(
      ['utc', 'Asia/Tokyo'].map((timeZone) =>
        ticks('2026-09-01T00:00:00Z', '2026-09-04T00:00:00Z', 1000, { timeZone }),
      ),
    );
    expect(utc.map((tick) => new Date(tick.time.time.number() * 1000).toISOString())).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
      '2026-09-03T00:00:00.000Z',
    ]);
    expect(tokyo.map((tick) => new Date(tick.time.time.number() * 1000).toISOString())).toEqual([
      '2026-09-01T15:00:00.000Z',
      '2026-09-02T15:00:00.000Z',
      '2026-09-03T15:00:00.000Z',
    ]);
    expect(tokyo.map((tick) => tick.text)).toEqual(['09/02(Wed)', '09/03(Thu)', '09/04(Fri)']);
  });

  it('steps across DST using local midnight', async () => {
    const result = await ticks('2026-03-07T00:00:00Z', '2026-03-10T00:00:00Z', 1000, { timeZone: 'America/New_York' });
    expect(result.map((tick) => new Date(tick.time.time.number() * 1000).toISOString())).toEqual([
      '2026-03-07T05:00:00.000Z',
      '2026-03-08T05:00:00.000Z',
      '2026-03-09T04:00:00.000Z',
    ]);
  });

  it('defaults to the local timezone', async () => {
    const start = '2026-09-01T00:00:00Z';
    const end = '2026-09-04T00:00:00Z';
    const [implicit, explicit] = await Promise.all([
      ticks(start, end, 1000, {}),
      ticks(start, end, 1000, { timeZone: 'local' }),
    ]);
    expect(implicit.map((tick) => [tick.time.time.toString(), tick.text])).toEqual(
      explicit.map((tick) => [tick.time.time.toString(), tick.text]),
    );
  });

  it.each([
    {
      start: '2026-01-01T00:00:00Z',
      end: '2026-04-01T00:00:00Z',
      resolution: 32768,
      expected: ['2026-01-31T15:00:00.000Z', '2026-02-28T15:00:00.000Z', '2026-03-31T15:00:00.000Z'],
    },
    {
      start: '2025-06-01T00:00:00Z',
      end: '2028-06-01T00:00:00Z',
      resolution: 262144,
      expected: ['2025-12-31T15:00:00.000Z', '2026-12-31T15:00:00.000Z', '2027-12-31T15:00:00.000Z'],
    },
  ])('aligns calendar boundaries at resolution $resolution', async ({ start, end, resolution, expected }) => {
    const result = await ticks(start, end, resolution, { timeZone: 'Asia/Tokyo' });
    expect(result.map((tick) => new Date(tick.time.time.number() * 1000).toISOString())).toEqual(expected);
  });

  it('keeps relative ticks independent of timezone', async () => {
    const results = await Promise.all(
      ['utc', 'Asia/Tokyo'].map((timeZone) =>
        ticks('1970-01-01T00:00:00Z', '1970-01-01T01:00:00Z', 1, { timeZone, relative: true }),
      ),
    );
    expect(results[0].length).toBeGreaterThan(0);
    expect(results[0].map((tick) => [tick.time.time.toString(), tick.text])).toEqual(
      results[1].map((tick) => [tick.time.time.toString(), tick.text]),
    );
  });

  it('aligns hours and supplies labelers with zoned components', async () => {
    const result = await ticks('2026-09-01T00:00:00Z', '2026-09-01T03:00:00Z', 32, {
      timeZone: 'Asia/Kathmandu',
      timeFormat: { minutes: ({ hour, minute }) => `${hour}:${minute}` },
    });
    expect(result.map((tick) => new Date(tick.time.time.number() * 1000).toISOString())).toEqual([
      '2026-09-01T00:15:00.000Z',
      '2026-09-01T01:15:00.000Z',
      '2026-09-01T02:15:00.000Z',
    ]);
    expect(result.map((tick) => tick.text)).toEqual(['6:0', '7:0', '8:0']);
  });
});
