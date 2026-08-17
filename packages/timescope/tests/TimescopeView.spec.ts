import { Decimal } from '#src/core/decimal';
import { TimescopeDataSourceBase } from '#src/main/TimescopeDataSource';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import { TimescopeViewRegistry, type TimescopeViewState } from '#src/main/TimescopeView';
import { describe, expect, it, vi } from 'vitest';

function row(time: number, value = time): TimescopeDataRow {
  return {
    times: { time: Decimal(time) },
    values: { value: Decimal(value) },
    data: undefined,
    range: [Decimal(time), Decimal(time), '[]'],
  };
}

function state(resolution: number, phase: TimescopeViewState['phase'] = 'changed', center = 10): TimescopeViewState {
  return {
    current: { center: Decimal(center), resolution: Decimal(resolution) },
    candidate: { center: Decimal(center), resolution: Decimal(resolution) },
    cursor: { center: Decimal(center) },
    axisSize: [10 / resolution, 10 / resolution],
    editing: phase === 'changing',
    animating: false,
    phase,
  };
}

describe('Timescope source views', () => {
  it('interns equal requests per source and viewport context', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    const first = source.requestView(context, { strategy: 'candidate-with-current' });
    const second = source.requestView(context, { strategy: 'candidate-with-current' });
    const otherContext = source.requestView(new TimescopeViewRegistry(), { strategy: 'candidate-with-current' });

    expect(first).toBe(second);
    expect(otherContext).not.toBe(first);
    source.releaseView(first);
    source.releaseView(second);
    source.releaseView(otherContext);
  });

  it('includes the data resolution policy in interned view identity', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source({ resolutions: [1, 3, 10] });
    const context = new TimescopeViewRegistry();
    const resolve = ({ resolution }: { resolution: Decimal }) => resolution.mul(5);
    const first = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve, snap: 'ceil' },
    });
    const second = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve, snap: 'ceil' },
    });
    const differentResolver = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve: ({ resolution }) => resolution.mul(5), snap: 'ceil' },
    });

    expect(first).toBe(second);
    expect(differentResolver).not.toBe(first);
    source.releaseView(first);
    source.releaseView(second);
    source.releaseView(differentResolver);
  });

  it.each([
    ['nearest', 3],
    ['floor', 1],
    ['ceil', 3],
  ] as const)('snaps a view resolution with the %s policy', (snap, expected) => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source({ chunkSize: 10, resolutions: [10, 1, 3] });
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const view = source.requestView(context, { strategy: 'settled-only', dataResolution: snap });

    expect(new Set(view.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([expected]));
    source.releaseView(view);
  });

  it('resolves a preferred resolution before snapping it to source candidates', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source({ chunkSize: 10, resolutions: [1, 3, 10] });
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const resolve = vi.fn(({ resolution }: { resolution: Decimal }) => resolution.mul(5));
    const view = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve, snap: 'ceil' },
    });

    expect(new Set(view.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([10]));
    expect(resolve).toHaveBeenCalledWith({ resolution: Decimal(2), resolutions: source.resolutions });
    source.releaseView(view);
  });

  it('snaps to implicit power-of-two resolutions when the source has no candidates', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source({ chunkSize: 10 });
    const context = new TimescopeViewRegistry();
    context.update(state(3));
    const floor = source.requestView(context, { strategy: 'settled-only', dataResolution: 'floor' });
    const ceil = source.requestView(context, { strategy: 'settled-only', dataResolution: 'ceil' });
    const defaults = source.requestView(context, { strategy: 'settled-only', dataResolution: {} });

    expect(new Set(floor.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([2]));
    expect(new Set(ceil.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([4]));
    expect(new Set(defaults.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([4]));
    source.releaseView(floor);
    source.releaseView(ceil);
    source.releaseView(defaults);
  });

  it('clamps floor and ceil policies and lets a fixed request bypass the resolver', () => {
    class Source extends TimescopeDataSourceBase {
      async query() {
        return [];
      }
    }
    const source = new Source({ chunkSize: 10, resolutions: [1, 3, 10] });
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const below = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve: 0.1, snap: 'floor' },
    });
    const above = source.requestView(context, {
      strategy: 'settled-only',
      dataResolution: { resolve: 100, snap: 'ceil' },
    });
    const resolve = vi.fn(() => 10);
    const fixed = source.requestView(context, {
      strategy: 'cursor-with-fallback',
      resolution: 3,
      dataResolution: { resolve, snap: 'ceil' },
    });

    expect(new Set(below.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([1]));
    expect(new Set(above.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([10]));
    expect(new Set(fixed.target.map((chunk) => chunk.resolution.number()))).toEqual(new Set([3]));
    expect(resolve).not.toHaveBeenCalled();
    source.releaseView(below);
    source.releaseView(above);
    source.releaseView(fixed);
  });

  it('uses loaded old-resolution rows while new target chunks are loading', async () => {
    const pending: { chunk: Parameters<TimescopeDataSourceBase['query']>[0]; resolve: () => void }[] = [];
    class Source extends TimescopeDataSourceBase {
      constructor() {
        super({ chunkSize: 10, resolutions: [1, 2] });
      }

      async query(chunk: Parameters<TimescopeDataSourceBase['query']>[0]) {
        if (chunk.resolution.eq(1)) await new Promise<void>((resolve) => pending.push({ chunk, resolve }));
        const rows = [];
        for (
          let time = chunk.range[0]!.add(chunk.resolution.div(2));
          time.lt(chunk.range[1]!);
          time = time.add(chunk.resolution)
        ) {
          rows.push(row(time.number(), chunk.resolution.number()));
        }
        return rows;
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    await view.waitForTarget();
    expect(new Set(view.query([Decimal(0), Decimal(20)]).map((entry) => entry.values.value?.number()))).toEqual(
      new Set([2]),
    );

    context.update(state(1));
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
    expect(new Set(view.query([Decimal(0), Decimal(20)]).map((entry) => entry.values.value?.number()))).toEqual(
      new Set([2]),
    );

    pending[0].resolve();
    await vi.waitFor(() =>
      expect(new Set(view.query([Decimal(0), Decimal(20)]).map((entry) => entry.values.value?.number()))).toEqual(
        new Set([1, 2]),
      ),
    );
    for (const { resolve } of pending.slice(1)) resolve();
    await view.waitForTarget();
    expect(new Set(view.query([Decimal(0), Decimal(20)]).map((entry) => entry.values.value?.number()))).toEqual(
      new Set([1]),
    );
    source.releaseView(view);
  });

  it('keeps fallback rows when target loading fails', async () => {
    class Source extends TimescopeDataSourceBase {
      constructor() {
        super({ chunkSize: 10, resolutions: [1, 2] });
      }

      async query(chunk: Parameters<TimescopeDataSourceBase['query']>[0]) {
        if (chunk.resolution.eq(1)) throw new Error('target failed');
        return [row(5, 2)];
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    await view.waitForTarget();

    context.update(state(1));
    await expect(view.waitForTarget()).rejects.toThrow('target failed');
    expect(view.query([Decimal(0), Decimal(10)]).map((entry) => entry.values.value?.number())).toEqual([2]);
    source.releaseView(view);
  });

  it('lets loaded-empty targets mask fallback rows', async () => {
    class Source extends TimescopeDataSourceBase {
      constructor() {
        super({ chunkSize: 10, resolutions: [1, 2] });
      }

      async query(chunk: Parameters<TimescopeDataSourceBase['query']>[0]) {
        return chunk.resolution.eq(1) ? [] : [row(5, 2), row(15, 2)];
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    context.update(state(2));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    await view.waitForTarget();
    expect(view.query([Decimal(0), Decimal(20)])).toHaveLength(2);

    context.update(state(1));
    await view.waitForTarget();
    expect(view.query([Decimal(0), Decimal(20)])).toEqual([]);
    source.releaseView(view);
  });

  it('waits for the latest target when the viewport changes during loading', async () => {
    const pending = new Map<string, () => void>();
    class Source extends TimescopeDataSourceBase {
      constructor() {
        super({ chunkSize: 10, resolutions: [1] });
      }

      async query(chunk: Parameters<TimescopeDataSourceBase['query']>[0]) {
        await new Promise<void>((resolve) => pending.set(chunk.id, resolve));
        return [row(chunk.range[0]!.number())];
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    context.update(state(1));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    const initialIds = new Set(view.target.map((chunk) => chunk.id));
    let settled = false;
    const waiting = view.waitForTarget().then(() => (settled = true));

    context.update(state(1, 'changed', 100));
    const latestIds = new Set(view.target.map((chunk) => chunk.id));
    for (const id of initialIds) pending.get(id)?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    for (const id of latestIds) pending.get(id)?.();
    await waiting;
    expect(settled).toBe(true);
    source.releaseView(view);
  });

  it('cancels one target waiter without affecting another', async () => {
    const pending: (() => void)[] = [];
    class Source extends TimescopeDataSourceBase {
      async query() {
        await new Promise<void>((resolve) => pending.push(resolve));
        return [row(5)];
      }
    }
    const source = new Source({ chunkSize: 100, resolutions: [1] });
    const context = new TimescopeViewRegistry();
    context.update(state(1));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    const first = new AbortController();
    const second = new AbortController();
    const firstWait = view.waitForTarget(first.signal);
    const secondWait = view.waitForTarget(second.signal);

    first.abort(new DOMException('cancelled', 'AbortError'));
    await expect(firstWait).rejects.toThrow('cancelled');
    for (const resolve of pending) resolve();
    await expect(secondWait).resolves.toBeUndefined();
    source.releaseView(view);
  });

  it('returns up to two outbound rows on each side', async () => {
    class Source extends TimescopeDataSourceBase {
      constructor() {
        super({ chunkSize: 100, resolutions: [1] });
      }
      async query() {
        return [-3, -2, -1, 1, 5, 9, 11, 12, 13].map((time) => row(time));
      }
    }
    const source = new Source();
    const context = new TimescopeViewRegistry();
    context.update(state(1));
    const view = source.requestView(context, { strategy: 'candidate-with-current' });
    await view.waitForTarget();

    expect(
      view.query([Decimal(0), Decimal(10)], { includeOutbound: 2 }).map((entry) => entry.times.time.number()),
    ).toEqual([-2, -1, 1, 5, 9, 11, 12]);
    source.releaseView(view);
  });
});
