import type { TimescopeViewportStateWire } from '#src/bridge/protocol';
import { createChunkList, type TimescopeChunk } from '#src/core/chunk';
import { Decimal, type DecimalLike } from '#src/core/decimal';
import { TimescopeObservable, type Un } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataResolution, TimescopeResolutionResolver, TimescopeResolutionSnap } from '#src/core/types';
import { getConstraintedResolution } from '#src/core/zoom';
import type { TimescopeChunkStore, TimescopeChunkStoreEntry } from '#src/main/TimescopeChunkStore';

export type TimescopeViewStrategyId = 'candidate-with-current' | 'settled-only' | 'cursor-with-fallback';

export type TimescopeViewRequest = {
  strategy: TimescopeViewStrategyId;
  resolution?: DecimalLike;
  dataResolution?: TimescopeDataResolution;
};

export type TimescopeViewSourceOptions = {
  chunkSize: number;
  chunkOffset: Decimal;
  resolutions?: readonly Decimal[];
};

export type TimescopeViewState = TimescopeViewportStateWire & {
  phase: 'changing' | 'changed' | 'prepare';
};

export type TimescopeViewQueryOptions = {
  includeOutbound?: number;
  loadMissing?: boolean;
};

export type TimescopeViewPoint = {
  range?: readonly [Decimal, Decimal, string];
  time?: { _minTime?: Decimal; _maxTime?: Decimal };
};

type TimescopeViewTile<T> = {
  id: string;
  role: 'target' | 'fallback';
  range: TimescopeRange<Decimal | undefined>;
  resolution: Decimal;
  rows: readonly T[];
  rowsByStart: readonly T[];
  rowsByEndDescending: readonly T[];
  owned: readonly boolean[];
  visibleRanges: readonly TimescopeRange<Decimal>[];
};

type ViewWindow = { range: TimescopeRange<Decimal>; resolution: Decimal };
type ViewSelection = { hold: true } | { target: readonly ViewWindow[]; retained: readonly ViewWindow[] };
type NormalizedRequest = {
  strategy: TimescopeViewStrategyId;
  resolution?: Decimal;
  dataResolution: {
    resolve?: TimescopeResolutionResolver;
    snap: TimescopeResolutionSnap;
  };
};
type ClassifiedChunk<T> = Omit<TimescopeViewTile<T>, 'role' | 'visibleRanges'>;

const classifications = new WeakMap<object, ClassifiedChunk<TimescopeViewPoint>>();
const resolutionResolverIds = new WeakMap<Function, number>();
let nextResolutionResolverId = 1;

function isDataResolutionOptions(value: TimescopeDataResolution): value is {
  resolve?: TimescopeResolutionResolver;
  snap?: TimescopeResolutionSnap;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeDataResolution(value: TimescopeDataResolution | undefined): NormalizedRequest['dataResolution'] {
  if (value === 'nearest' || value === 'floor' || value === 'ceil') return { snap: value };
  if (value && isDataResolutionOptions(value)) return { resolve: value.resolve, snap: value.snap ?? 'nearest' };
  return { resolve: value as TimescopeResolutionResolver | undefined, snap: 'nearest' };
}

function rangeAround(center: Decimal, resolution: Decimal, left: number, right: number): TimescopeRange<Decimal> {
  return [center.sub(resolution.mul(left)), center.add(resolution.mul(right))];
}

function bufferedRange([start, end]: TimescopeRange<Decimal>): TimescopeRange<Decimal> {
  const span = end.sub(start);
  return [start.sub(span), end.add(span)];
}

function unionRange(windows: readonly ViewWindow[]): TimescopeRange<Decimal> | null {
  if (!windows.length) return null;
  let start = windows[0].range[0];
  let end = windows[0].range[1];
  for (const window of windows.slice(1)) {
    if (window.range[0].lt(start)) start = window.range[0];
    if (window.range[1].gt(end)) end = window.range[1];
  }
  return [start, end];
}

const strategies: Record<
  TimescopeViewStrategyId,
  (state: TimescopeViewState, request: NormalizedRequest) => ViewSelection
> = {
  'candidate-with-current': (state) => {
    const candidate = rangeAround(
      state.candidate.center,
      state.candidate.resolution,
      state.axisSize[0],
      state.axisSize[1],
    );
    const current = rangeAround(state.current.center, state.current.resolution, state.axisSize[0], state.axisSize[1]);
    return {
      target: [{ range: candidate, resolution: state.candidate.resolution }],
      retained:
        state.phase === 'changed'
          ? []
          : [
              { range: bufferedRange(candidate), resolution: state.candidate.resolution },
              { range: bufferedRange(current), resolution: state.current.resolution },
            ],
    };
  },
  'settled-only': (state) => {
    if (state.editing || state.animating) return { hold: true };
    return {
      target: [
        {
          range: rangeAround(state.current.center, state.current.resolution, state.axisSize[0], state.axisSize[1]),
          resolution: state.current.resolution,
        },
      ],
      retained: [],
    };
  },
  'cursor-with-fallback': (state, request) => {
    const resolution = request.resolution ?? state.current.resolution;
    const range = rangeAround(state.cursor.center, resolution, 0.5, 0.5);
    return {
      target: [{ range, resolution }],
      retained: state.current.resolution.eq(resolution) ? [] : [{ range, resolution: state.current.resolution }],
    };
  },
};

function rowRange(row: TimescopeViewPoint): readonly [Decimal, Decimal, ...unknown[]] {
  if (row.range) return row.range;
  return [row.time!._minTime!, row.time!._maxTime!];
}

function rowIntersectsRange(row: TimescopeViewPoint, [start, end]: TimescopeRange<Decimal | undefined>) {
  const [min, max] = rowRange(row);
  if (min.eq(max)) return (!start || start.le(min)) && (!end || min.lt(end));
  return (!start || start.lt(max)) && (!end || min.lt(end));
}

function rangesIntersect(a: TimescopeRange<Decimal | undefined>, b: TimescopeRange<Decimal | undefined>) {
  return (!a[1] || !b[0] || a[1].gt(b[0])) && (!b[1] || !a[0] || b[1].gt(a[0]));
}

function subtractRange(range: TimescopeRange<Decimal>, covered: readonly TimescopeRange<Decimal>[]) {
  let visible = [range];
  for (const [coveredStart, coveredEnd] of covered) {
    visible = visible.flatMap(([start, end]) => {
      if (coveredEnd.le(start) || end.le(coveredStart)) return [[start, end] as TimescopeRange<Decimal>];
      const result: TimescopeRange<Decimal>[] = [];
      if (start.lt(coveredStart)) result.push([start, coveredStart]);
      if (coveredEnd.lt(end)) result.push([coveredEnd, end]);
      return result;
    });
  }
  return visible;
}

function intersectRange(
  range: TimescopeRange<Decimal | undefined>,
  clip: TimescopeRange<Decimal>,
): TimescopeRange<Decimal> | undefined {
  if (!range[0] || !range[1]) return;
  const start = range[0].gt(clip[0]) ? range[0] : clip[0];
  const end = range[1].lt(clip[1]) ? range[1] : clip[1];
  return start.lt(end) ? [start, end] : undefined;
}

function classify<T extends TimescopeViewPoint>(chunk: TimescopeChunk<readonly T[]>): ClassifiedChunk<T> {
  const cached = classifications.get(chunk) as ClassifiedChunk<T> | undefined;
  if (cached) return cached;
  const rowsByStart = Object.freeze(
    [...(chunk.data ?? [])].sort((a, b) => rowRange(a)[0].cmp(rowRange(b)[0]) || rowRange(a)[1].cmp(rowRange(b)[1])),
  );
  const classified: ClassifiedChunk<T> = Object.freeze({
    id: chunk.id,
    range: Object.freeze([...chunk.range]) as TimescopeRange<Decimal | undefined>,
    resolution: chunk.resolution,
    rows: rowsByStart,
    rowsByStart,
    rowsByEndDescending: Object.freeze(
      [...rowsByStart].sort((a, b) => rowRange(b)[1].cmp(rowRange(a)[1]) || rowRange(b)[0].cmp(rowRange(a)[0])),
    ),
    owned: Object.freeze(rowsByStart.map((row) => rowIntersectsRange(row, chunk.range))),
  });
  classifications.set(chunk, classified as ClassifiedChunk<TimescopeViewPoint>);
  return classified;
}

export class TimescopeViewRegistry {
  #state?: TimescopeViewState;
  #listeners = new Set<(state: TimescopeViewState) => void>();

  get state() {
    return this.#state;
  }

  subscribe(listener: (state: TimescopeViewState) => void): Un {
    this.#listeners.add(listener);
    if (this.#state) listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  update(state: TimescopeViewState) {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}

export class TimescopeView<T extends TimescopeViewPoint> extends TimescopeObservable {
  #store: TimescopeChunkStore<T>;
  #source: TimescopeViewSourceOptions;
  #request: NormalizedRequest;
  #entries = new Map<string, TimescopeChunkStoreEntry<T>>();
  #target = new Map<string, TimescopeChunk>();
  #retainedIds = new Set<string>();
  #targetRange: TimescopeRange<Decimal> | null = null;
  #renderRange: TimescopeRange<Decimal> | null = null;
  #targetGeneration = 0;
  #unsubs: Un[] = [];
  #targetWaiters = new Set<{ reject: (reason: unknown) => void }>();

  constructor(
    store: TimescopeChunkStore<T>,
    context: TimescopeViewRegistry,
    source: TimescopeViewSourceOptions,
    request: TimescopeViewRequest,
  ) {
    super();
    this.#store = store;
    this.#source = source;
    this.#request = {
      strategy: request.strategy,
      resolution: Decimal(request.resolution),
      dataResolution: normalizeDataResolution(request.resolution === undefined ? request.dataResolution : undefined),
    };
    this.#unsubs.push(context.subscribe((state) => this.#update(state)));
    this.#unsubs.push(
      store.on('entrychange', ({ value }) => {
        if (this.#entries.get(value.descriptor.id) !== value) return;
        if (value.state === 'idle' && this.#target.has(value.descriptor.id)) this.#targetGeneration++;
        if (value.state === 'idle' && (value.payload || this.#target.has(value.descriptor.id))) this.#load(value);
        if (value.state === 'loading' && !value.payload) return;
        this.#prune();
        this.changed();
      }),
    );
  }

  get target() {
    return [...this.#target.values()];
  }

  get targetRange() {
    return this.#targetRange;
  }

  get entries(): readonly T[] {
    return this.#targetRange ? this.query(this.#targetRange) : [];
  }

  query(range: TimescopeRange<Decimal>, options: TimescopeViewQueryOptions = {}): readonly T[] {
    if (options.loadMissing) this.loadTarget();
    const tiles = this.#tiles(range);
    const fragments = tiles
      .flatMap((tile) => tile.visibleRanges.map((visible) => ({ tile, visible })))
      .sort((a, b) => a.visible[0].cmp(b.visible[0]) || a.visible[1].cmp(b.visible[1]));
    const selected = new Set<T>();
    for (const tile of tiles) {
      for (let index = 0; index < tile.rows.length; index++) {
        if (!tile.owned[index]) continue;
        const row = tile.rows[index];
        const start = rowRange(row)[0];
        let left = 0;
        let right = fragments.length;
        while (left < right) {
          const middle = left + Math.floor((right - left) / 2);
          if (fragments[middle].visible[1].le(start)) left = middle + 1;
          else right = middle;
        }
        const owner = fragments[left];
        if (owner?.tile === tile && rowIntersectsRange(row, owner.visible)) selected.add(row);
      }
    }

    const outbound = Math.max(0, Math.floor(options.includeOutbound ?? 0));
    if (outbound && tiles.length) {
      let added = 0;
      for (const row of fragments[0].tile.rowsByEndDescending) {
        if (selected.has(row) || rowRange(row)[1].gt(range[0])) continue;
        selected.add(row);
        if (++added === outbound) break;
      }
      added = 0;
      for (const row of fragments.at(-1)!.tile.rowsByStart) {
        if (selected.has(row) || rowRange(row)[0].lt(range[1])) continue;
        selected.add(row);
        if (++added === outbound) break;
      }
    }
    return [...selected].sort((a, b) => rowRange(a)[0].cmp(rowRange(b)[0]) || rowRange(a)[1].cmp(rowRange(b)[1]));
  }

  nearest(time: Decimal, getTime: (entry: T) => Decimal | undefined): T | undefined {
    let selected: T | undefined;
    let selectedTime: Decimal | undefined;
    for (const entry of this.entries) {
      const entryTime = getTime(entry);
      if (!entryTime || entryTime.gt(time)) continue;
      if (!selectedTime || entryTime.gt(selectedTime)) {
        selected = entry;
        selectedTime = entryTime;
      }
    }
    return selected;
  }

  #tiles(range: TimescopeRange<Decimal>): TimescopeViewTile<T>[] {
    const targetZoom = this.#target.values().next().value?.zoom as number | undefined;
    const chunks: TimescopeChunk<readonly T[]>[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.payload && entry.expires <= Date.now() && entry.state === 'loaded') this.#load(entry);
      if (entry.payload) chunks.push(entry.payload);
    }
    chunks.sort((a, b) => {
      const aTarget = this.#target.has(a.id);
      const bTarget = this.#target.has(b.id);
      if (aTarget !== bTarget) return aTarget ? -1 : 1;
      if (!aTarget && targetZoom !== undefined) {
        const distance = Math.abs(a.zoom - targetZoom) - Math.abs(b.zoom - targetZoom);
        if (distance) return distance;
      }
      return a.resolution.cmp(b.resolution) || (a.range[0]?.cmp(b.range[0]!) ?? 0) || a.id.localeCompare(b.id);
    });

    const covered: TimescopeRange<Decimal>[] = [];
    const result: TimescopeViewTile<T>[] = [];
    for (const chunk of chunks) {
      const visible = intersectRange(chunk.range, range);
      if (!visible) continue;
      const visibleRanges = subtractRange(visible, covered);
      if (!visibleRanges.length) continue;
      result.push({
        ...classify(chunk),
        role: this.#target.has(chunk.id) ? 'target' : 'fallback',
        visibleRanges,
      });
      covered.push(...visibleRanges);
    }
    return result;
  }

  loadTarget() {
    for (const descriptor of this.#target.values()) {
      const entry = this.#entries.get(descriptor.id);
      if (entry) this.#load(entry);
    }
  }

  loadRetained() {
    for (const [id, entry] of this.#entries) {
      if (!this.#target.has(id)) this.#load(entry);
    }
  }

  async waitForTarget(signal?: AbortSignal) {
    signal?.throwIfAborted();
    let reject!: (reason: unknown) => void;
    const abort = new Promise<never>((_, nextReject) => (reject = nextReject));
    const waiter = { reject };
    this.#targetWaiters.add(waiter);
    const onAbort = () => reject(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      while (true) {
        const generation = this.#targetGeneration;
        const load = Promise.all(
          [...this.#target.values()].map(async (descriptor) => {
            const entry = this.#entries.get(descriptor.id)!;
            await this.#store.loadEntry(entry);
          }),
        );
        try {
          await Promise.race([load, abort]);
        } catch (error) {
          if (signal?.aborted) throw error;
          if (generation !== this.#targetGeneration) continue;
          throw error;
        }
        if (generation === this.#targetGeneration) return;
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.#targetWaiters.delete(waiter);
    }
  }

  cancelTargetWaiters() {
    for (const waiter of this.#targetWaiters) waiter.reject(new DOMException('Target wait aborted', 'AbortError'));
    this.#targetWaiters.clear();
  }

  dispose() {
    this.cancelTargetWaiters();
    for (const unsub of this.#unsubs) unsub?.();
    this.#unsubs = [];
    for (const entry of this.#entries.values()) this.#store.releaseChunk(entry);
    this.#entries.clear();
  }

  #update(state: TimescopeViewState) {
    const selection = strategies[this.#request.strategy](state, this.#request);
    if ('hold' in selection) return;
    const target = this.#descriptors(selection.target);
    const desired = new Map([...this.#descriptors(selection.retained), ...target]);
    const targetChanged = target.size !== this.#target.size || [...target.keys()].some((id) => !this.#target.has(id));
    this.#target = target;
    if (targetChanged) this.#targetGeneration++;
    this.#retainedIds = new Set([...desired.keys()].filter((id) => !target.has(id)));
    this.#targetRange = unionRange(selection.target);
    this.#renderRange = unionRange([...selection.target, ...selection.retained]);

    for (const descriptor of desired.values()) {
      if (!this.#entries.has(descriptor.id)) this.#entries.set(descriptor.id, this.#store.acquireChunk(descriptor));
    }
    for (const [id, entry] of this.#entries) {
      if (desired.has(id)) continue;
      if (this.#renderRange && rangesIntersect(entry.descriptor.range, this.#renderRange)) continue;
      this.#entries.delete(id);
      this.#store.releaseChunk(entry);
    }

    const shouldLoad = state.phase !== 'changing' || this.#request.strategy === 'candidate-with-current';
    if (shouldLoad) this.loadTarget();
    else {
      for (const descriptor of this.#target.values()) {
        const cached = this.#store.peekChunk(descriptor);
        const entry = this.#entries.get(descriptor.id);
        if (cached && entry) entry.payload = cached;
      }
    }
    this.#prune();
    this.changed();
  }

  #descriptors(windows: readonly ViewWindow[]) {
    const result = new Map<string, TimescopeChunk>();
    for (const window of windows) {
      const { resolve, snap } = this.#request.dataResolution;
      const target =
        Decimal(
          typeof resolve === 'function'
            ? resolve({ resolution: window.resolution, resolutions: this.#source.resolutions ?? [] })
            : resolve,
        ) ?? window.resolution;
      if (!target.isPositive()) throw new RangeError('Resolved data resolution must be positive');
      const resolution = getConstraintedResolution(target, this.#source.resolutions, snap);
      const left = this.#request.strategy === 'cursor-with-fallback' ? this.#source.chunkSize / 2 : undefined;
      const range =
        left === undefined
          ? window.range
          : rangeAround(window.range[0].add(window.range[1]).div(2), resolution, left, left);
      for (const chunk of createChunkList(range, resolution, this.#source.chunkSize, this.#source.chunkOffset)) {
        result.set(chunk.id, chunk);
      }
    }
    return result;
  }

  #load(entry: TimescopeChunkStoreEntry<T>) {
    void this.#store.loadEntry(entry).catch(() => {});
  }

  #prune() {
    if (!this.#renderRange) return;
    const visible = new Set(this.#tiles(this.#renderRange).map((tile) => tile.id));
    for (const [id, entry] of this.#entries) {
      if (this.#target.has(id) || this.#retainedIds.has(id) || visible.has(id)) continue;
      this.#entries.delete(id);
      this.#store.releaseChunk(entry);
    }
  }
}

export function timescopeViewRequestKey(request: TimescopeViewRequest) {
  const fixedResolution = Decimal(request.resolution)?.toString();
  const dataResolution = normalizeDataResolution(fixedResolution === undefined ? request.dataResolution : undefined);
  let resolve: string | number | undefined;
  if (typeof dataResolution.resolve === 'function') {
    resolve = resolutionResolverIds.get(dataResolution.resolve);
    if (resolve === undefined) {
      resolve = nextResolutionResolverId++;
      resolutionResolverIds.set(dataResolution.resolve, resolve);
    }
  } else {
    resolve = Decimal(dataResolution.resolve)?.toString();
  }
  return JSON.stringify({
    strategy: request.strategy,
    resolution: fixedResolution,
    resolve,
    snap: dataResolution.snap,
  });
}
