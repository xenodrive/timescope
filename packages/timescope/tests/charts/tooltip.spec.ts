import { createChunkList, type TimescopeChunkSize } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { TimescopeSeriesTooltip } from '#src/main/layers/TimescopeSeriesTooltip';
import type { TimescopeLoadRequest } from '#src/main/TimescopeDataLoader';
import { TimescopeDataSeries, type TimescopeSeriesInput } from '#src/main/TimescopeDataSeries';
import { chunkStoreForDataSource, createDataSource } from '#src/main/TimescopeDataSource';
import { TimescopeDomain } from '#src/main/TimescopeDomain';
import { TimescopeViewRegistry } from '#src/main/TimescopeView';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { deferred } from '../helpers/deferred';
import { viewState } from '../helpers/view';

function fixture(immediate = false, chunkSize: TimescopeChunkSize = 4, tooltip?: TimescopeSeriesInput['tooltip']) {
  const rows = (chunk: TimescopeLoadRequest) =>
    [0, 1, 2, 3].map((index) => ({
      time: chunk.range[0]!.add(chunk.resolution.mul(index)),
      value: chunk.resolution,
    }));
  const pending = new Map<
    string,
    { chunk: TimescopeLoadRequest; result: ReturnType<typeof deferred<ReturnType<typeof rows>>> }
  >();
  const loader = vi.fn((chunk: TimescopeLoadRequest) => {
    if (!chunk.resolution.eq('0.25')) return Promise.resolve(rows(chunk));
    const result = deferred<ReturnType<typeof rows>>();
    pending.set(`${chunk.range[0]}:${chunk.resolution}`, { chunk, result });
    return result.promise;
  });
  const source = createDataSource({ loader, immediate, chunkSize });
  const registry = new TimescopeViewRegistry();
  const series = new TimescopeDataSeries({
    sources: { source },
    domain: new TimescopeDomain({ range: [0, 2] }),
    options: { data: { source: 'source', instantaneous: { zoom: 2 } }, tooltip },
  });
  const provider = new TimescopeSeriesTooltip({ series, viewContext: registry });
  onTestFinished(() => {
    provider.dispose();
    series.dispose();
    for (const { chunk, result } of pending.values()) result.resolve(rows(chunk));
  });
  const range: [Decimal, Decimal] = [Decimal(10), Decimal(11)];
  return {
    loader,
    provider,
    pending,
    rows,
    async preload() {
      const store = chunkStoreForDataSource(source);
      await Promise.all(
        createChunkList([Decimal(8), Decimal(24)], Decimal(2), 4).map((chunk) => store.loadChunk(chunk)),
      );
    },
    move() {
      registry.update(
        viewState(range, Decimal('0.25'), { currentResolution: Decimal(2), editing: true, phase: 'changing' }),
      );
    },
    load(loadMissing: boolean, selectedRange = range) {
      return provider.loadData(selectedRange, Decimal('0.25'), undefined, {
        fallbackResolution: Decimal(2),
        loadMissing,
      });
    },
  };
}

describe('instantaneous data', () => {
  it.each([undefined, 3])('passes digits=%s and the unrounded value to a custom formatter', async (digits) => {
    const format = vi.fn(({ value }: { value: Decimal | null }) => `Custom ${value}`);
    const view = fixture(false, 4, { digits, format });
    await view.preload();
    view.move();
    const result = await view.load(false);
    expect(result.data.text).toEqual(['Custom 2']);
    expect(format).toHaveBeenCalledWith(expect.objectContaining({ digits: digits ?? 2 }));
    expect(format.mock.calls[0][0].value?.eq(2)).toBe(true);
  });

  it.each([
    { domainDigits: undefined, tooltipDigits: undefined, expected: 'Reading 0.24 V' },
    { domainDigits: 2, tooltipDigits: undefined, expected: 'Reading 0.24 V' },
    { domainDigits: 1, tooltipDigits: 3, expected: 'Reading 0.238 V' },
    { domainDigits: 3, tooltipDigits: 0, expected: 'Reading 0 V' },
  ])(
    'resolves tooltip digits $tooltipDigits before domain digits $domainDigits',
    async ({ domainDigits, tooltipDigits, expected }) => {
      const source = createDataSource([{ time: 0, value: '0.23781' }]);
      const domain = new TimescopeDomain({ range: [0, 1], digits: domainDigits, unit: 'V', axis: { digits: 1 } });
      const series = new TimescopeDataSeries({
        sources: { source },
        domain,
        options: { data: { source: 'source', name: 'Reading' }, tooltip: { digits: tooltipDigits } },
      });
      const registry = new TimescopeViewRegistry();
      const provider = new TimescopeSeriesTooltip({ series, viewContext: registry });
      registry.update(viewState([Decimal(0), Decimal(1)], Decimal(1)));
      try {
        await Promise.all(
          createChunkList([Decimal(0), Decimal(4)], Decimal(1), 4).map((chunk) =>
            chunkStoreForDataSource(source).loadChunk(chunk),
          ),
        );
        const result = await provider.loadData([Decimal(0), Decimal(1)], Decimal(1));
        expect(result.data.text).toEqual([expected]);
      } finally {
        provider.dispose();
        series.dispose();
      }
    },
  );

  it('expands the cursor query using the selected resolution chunk size', async () => {
    const view = fixture(false, (resolution) => (resolution.eq('0.25') ? 8 : 4));
    view.move();
    const result = await view.load(false, [Decimal(10), Decimal('10.25')]);
    expect(result.meta.time.eq('9.125')).toBe(true);
  });

  it('uses the preceding cached sample while moving without loading deferred data', async () => {
    const view = fixture();
    await view.preload();
    view.loader.mockClear();
    view.move();
    const result = await view.load(false, [Decimal(11), Decimal('11.5')]);
    expect(result.data.t.map(Number)).toEqual([10]);
    // Values are projected into the fixed [0, 2] domain.
    expect([...result.data.y]).toEqual([1]);
    expect(view.loader).not.toHaveBeenCalled();
  });

  it('keeps fallback data until the instantaneous resolution is available', async () => {
    const view = fixture();
    await view.preload();
    view.move();
    const fallback = await view.load(true);
    expect(new Set(fallback.data.y)).toEqual(new Set([1]));
    await vi.waitFor(() => expect(view.pending.size).toBeGreaterThan(0));
    const changed = new Promise<void>((resolve) => {
      const unsubscribe = view.provider.on('change', () => {
        unsubscribe();
        resolve();
      });
    });
    for (const { chunk, result } of view.pending.values()) result.resolve(view.rows(chunk));
    await changed;
    const instantaneous = await view.load(false);
    expect(new Set(instantaneous.data.y)).toEqual(new Set([0.125]));
  });

  it.each([false, true])('honors immediate=%s when no fallback is cached during movement', async (immediate) => {
    const view = fixture(immediate);
    view.move();
    await view.load(false);
    if (immediate) expect(view.loader).toHaveBeenCalled();
    else expect(view.loader).not.toHaveBeenCalled();
  });
});
