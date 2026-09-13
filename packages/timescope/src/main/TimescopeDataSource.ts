import {
  DEFAULT_CHUNK_SIZE,
  type TimescopeChunk,
  type TimescopeChunkLoader,
  type TimescopeChunkLoaderContext,
} from '#src/core/chunk';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { resolutionFor } from '#src/core/zoom';
import { TimescopeReducer as SnapshotReducer } from '#src/main/reducers/TimescopeReducer';
import { TimescopeChunkStore } from '#src/main/TimescopeChunkStore';
import {
  normalizeDataRows,
  type TimescopeDataRow,
  type TimescopeDataRowInput,
  type TimescopeMappings,
} from '#src/main/TimescopeData';
import {
  TimescopeView,
  type TimescopeViewRegistry,
  type TimescopeViewRequest,
  timescopeViewRequestKey,
} from '#src/main/TimescopeView';

export type TimescopeSourceCommonOptions = {
  /** Number of selected-resolution intervals per chunk for tiled loading. */
  chunkSize?: number;
  /** Time offset for chunk indexing. */
  chunkOffset?: NumberLike;
  /** Continue loading charts backed by this source during view interactions. */
  immediate?: boolean;
  /** Available source intervals used to load data. A chunk spans chunkSize * resolution time units. */
  resolutions?: NumberLike[];
  zoomLevels?: number[];
};
export type TimescopeDataDecoder = (
  payload: any,
) => Promise<readonly TimescopeDataRowInput[]> | readonly TimescopeDataRowInput[];
export type TimescopePercentilesReducer = {
  type: 'percentiles';
  values?: readonly (0.5 | 0.9 | 0.95)[];
  primary?: 0.5 | 0.9 | 0.95;
};
export type TimescopeReducer = 'min-max-avg' | 'percentiles' | 'null' | TimescopePercentilesReducer;
export type TimescopeSnapshotLoader<T = unknown> = (context?: TimescopeChunkLoaderContext) => T | Promise<T>;
type TimescopeSnapshotAcquisition =
  | { url: string; data?: never; loader?: never }
  | { data: unknown; url?: never; loader?: never }
  | { loader: TimescopeSnapshotLoader; url?: never; data?: never; chunked: false };
type TimescopeChunkedAcquisition =
  | { url: string; data?: never; loader?: never }
  | { loader: TimescopeChunkLoader<unknown>; url?: never; data?: never; chunked?: true };
type TimescopeSourceTransform =
  | { decoder: TimescopeDataDecoder; mappings?: never }
  | { decoder?: never; mappings: TimescopeMappings }
  | { decoder?: never; mappings?: never };
export type TimescopeSourceOptions = TimescopeSourceCommonOptions &
  TimescopeSourceTransform &
  (
    | (TimescopeSnapshotAcquisition & { reducer?: TimescopeReducer })
    | (TimescopeChunkedAcquisition & { reducer?: never })
  );
export type TimescopeSourceInput =
  | string
  | readonly TimescopeDataRowInput[]
  | TimescopeChunkLoader<readonly TimescopeDataRowInput[]>
  | TimescopeSourceOptions
  | TimescopeDataSource<any>;
export type TimescopeOptionsSources<Sources extends Record<string, TimescopeSourceInput>> = {
  [K in keyof Sources]: Sources[K];
};

type MinMaxAvgSuffix = 'avg' | 'first' | 'last' | 'min' | 'max';
type PercentileSuffix = 'first' | 'last' | 'min' | 'max' | 'p50' | 'p90' | 'p95';
type InferReturnedRow<T> = Awaited<T> extends readonly (infer R)[] ? R : never;
type InferLoaderRow<T> = [InferReturnedRow<T>] extends [never] ? TimescopeDataRowInput : InferReturnedRow<T>;
export type InferSourceRow<S> =
  S extends TimescopeDataSource<infer R>
    ? R
    : S extends { mappings: infer M extends TimescopeMappings }
      ? { times: M['times']; values: M['values'] }
      : S extends { decoder: (...args: any[]) => infer R }
        ? InferReturnedRow<R>
        : S extends { loader: (...args: any[]) => infer R }
          ? InferLoaderRow<R>
          : S extends (...args: any[]) => infer R
            ? InferLoaderRow<R>
            : S extends { data: readonly (infer R)[] }
              ? R
              : S extends readonly (infer R)[]
                ? R
                : TimescopeDataRowInput;
export type InferTimesKey<R> = R extends { times: infer T extends Record<string, unknown> } ? string & keyof T : 'time';
type InferRawValuesKey<R> = R extends { values: infer V extends Record<string, unknown> } ? string & keyof V : 'value';
type InferRowData<R> = R extends { data?: infer D } ? D : undefined;
export type InferSourceData<S> = S extends unknown ? InferRowData<InferSourceRow<S>> : never;
type InferSnapshotValueKey<S, K extends string> = S extends { reducer: 'min-max-avg' }
  ? K | `${K}#${MinMaxAvgSuffix}`
  : S extends { reducer: 'percentiles' | { type: 'percentiles' } }
    ? K | `${K}#${PercentileSuffix}`
    : K;
export type InferSourceValueKey<S> =
  InferRawValuesKey<InferSourceRow<S>> extends infer K extends string
    ? S extends TimescopeDataSource<any>
      ? K
      : S extends { loader: unknown }
        ? S extends { chunked: false }
          ? InferSnapshotValueKey<S, K>
          : K
        : S extends { url: infer U extends string }
          ? U extends `${string}{${string}}${string}`
            ? K
            : InferSnapshotValueKey<S, K>
          : S extends string
            ? K
            : InferSnapshotValueKey<S, K>
    : never;

export type TimescopeDataSourceInvalidation = {
  range?: TimescopeRange<Decimal | undefined>;
  revision: number;
};

/** A finite-query data source. The generic row preserves source key inference. */
export interface TimescopeDataSource<Row = TimescopeDataRowInput> extends Pick<
  TimescopeObservable<TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>>,
  'on' | 'revision'
> {
  readonly chunkSize: number;
  readonly chunkOffset: Decimal;
  readonly resolutions?: readonly Decimal[];
  readonly immediate: boolean;
  readonly invalidation?: TimescopeDataSourceInvalidation;
  readonly outputRow?: Row;
  query(chunk: TimescopeChunk, context: TimescopeChunkLoaderContext): Promise<readonly TimescopeDataRow[]>;
  invalidate(range?: TimescopeRange<Decimal | undefined>): void;
  requestView?(context: TimescopeViewRegistry, request: TimescopeViewRequest): TimescopeView<TimescopeDataRow>;
  releaseView?(view: TimescopeView<TimescopeDataRow>): void;
}

export interface TimescopeMutableDataSource<Row = TimescopeDataRowInput, Input = Row> extends TimescopeDataSource<Row> {
  append(rows: Input | readonly Input[]): Promise<void>;
  replace(range: TimescopeRange<TimeLike<never>>, rows: Input | readonly Input[]): Promise<void>;
}

export abstract class TimescopeDataSourceBase<Row = TimescopeDataRowInput>
  extends TimescopeObservable<TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>>
  implements TimescopeDataSource<Row>
{
  readonly chunkSize: number;
  readonly chunkOffset: Decimal;
  readonly resolutions?: readonly Decimal[];
  readonly immediate: boolean;
  declare readonly outputRow?: Row;
  #invalidation?: TimescopeDataSourceInvalidation;

  constructor(
    options: Pick<
      TimescopeSourceOptions,
      'chunkSize' | 'chunkOffset' | 'resolutions' | 'zoomLevels' | 'immediate'
    > = {},
  ) {
    super();
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    if (!Number.isSafeInteger(this.chunkSize) || this.chunkSize <= 0) {
      throw new RangeError('Chunk size must be a positive integer');
    }
    this.chunkOffset = Decimal(options.chunkOffset ?? 0);
    this.resolutions = options.resolutions?.map((value) => Decimal(value)) ?? options.zoomLevels?.map(resolutionFor);
    this.immediate = options.immediate ?? true;
  }

  abstract query(chunk: TimescopeChunk, context: TimescopeChunkLoaderContext): Promise<readonly TimescopeDataRow[]>;

  requestView(context: TimescopeViewRegistry, request: TimescopeViewRequest) {
    return requestViewForDataSource(this, context, request);
  }

  releaseView(view: TimescopeView<TimescopeDataRow>) {
    releaseViewForDataSource(view);
  }

  get invalidation() {
    return this.#invalidation;
  }

  invalidate(range?: TimescopeRange<Decimal | undefined>) {
    this.changed();
    this.#invalidation = { range, revision: this.revision };
    this.dispatchEvent(new TimescopeEvent('invalidate', this.#invalidation));
  }
}

type DataSourceOptions = TimescopeSourceOptions & {
  chunkOffset?: Decimal;
  resolutions?: Decimal[];
};

function resolveUrl(url: string, chunk: TimescopeChunk) {
  return url.replace(/{[a-zA-Z]+}/g, (match) => {
    switch (match.slice(1, -1)) {
      case 'z':
      case 'zoom':
        return chunk.zoom.toString();
      case 'r':
      case 'resolution':
        return chunk.resolution.rescale().toString();
      case 's':
      case 'start':
        return chunk.range[0]!.rescale().toString();
      case 'e':
      case 'end':
        return chunk.range[1]!.rescale().toString();
      default:
        console.warn(`Unknown URL template: ${match}`);
        return match;
    }
  });
}

async function canonicalize(payload: unknown, decoder?: TimescopeDataDecoder, mappings?: TimescopeMappings) {
  if (decoder) return normalizeDataRows(await decoder(payload));
  if (payload instanceof Response) payload = await payload.json();
  return normalizeDataRows(payload, mappings);
}

function rowRange(rows: readonly TimescopeDataRow[]): TimescopeRange<Decimal> | undefined {
  if (!rows.length) return;
  let start = rows[0].range[0];
  let end = rows[0].range[1];
  for (const row of rows.slice(1)) {
    if (row.range[0].lt(start)) start = row.range[0];
    if (row.range[1].gt(end)) end = row.range[1];
  }
  return [start, end];
}

function rowIntersectsRange(row: TimescopeDataRow, [start, end]: TimescopeRange<Decimal>) {
  if (row.range[0].eq(row.range[1])) return start.le(row.range[0]) && row.range[0].lt(end);
  return start.lt(row.range[1]) && row.range[0].lt(end);
}

function mutationRange(
  existing: readonly TimescopeDataRow[],
  changed: TimescopeRange<Decimal>,
  additions: readonly TimescopeDataRow[],
): TimescopeRange<Decimal | undefined> {
  const affected = existing.filter((row) => rowIntersectsRange(row, changed));
  const affectedSet = new Set(affected);
  const support = rowRange([...affected, ...additions]);
  const contextStart = support && support[0].lt(changed[0]) ? support[0] : changed[0];
  const contextEnd = support && support[1].gt(changed[1]) ? support[1] : changed[1];
  let start: Decimal | undefined = contextStart;
  let end: Decimal | undefined = contextEnd;
  const ordered = [...existing].toSorted((a, b) => a.range[0].cmp(b.range[0]));
  const affectedKinds = new Set([...affected, ...additions].map((row) => row.range[0].eq(row.range[1])));
  for (const points of affectedKinds) {
    const relevant = ordered.filter((row) => !affectedSet.has(row) && row.range[0].eq(row.range[1]) === points);
    const before = relevant.findLast((row) => row.range[0].lt(contextStart));
    const after = relevant.find((row) => row.range[0].ge(contextEnd));
    if (!before) start = undefined;
    else if (start && before.range[0].lt(start)) start = before.range[0];
    if (!after) end = undefined;
    else if (end && after.range[1].gt(end)) end = after.range[1];
  }
  return [start, end];
}

class SnapshotDataSource<Row> extends TimescopeDataSourceBase<Row> implements TimescopeMutableDataSource<Row> {
  #acquire: () => unknown | Promise<unknown>;
  #decoder?: TimescopeDataDecoder;
  #mappings?: TimescopeMappings;
  #reducer: SnapshotReducer;
  #state?: Promise<void>;
  #acquisitionGeneration = 0;
  #rows: TimescopeDataRow[] = [];
  #mutable: boolean;

  constructor(options: DataSourceOptions, acquire: () => unknown | Promise<unknown>, mutable: boolean) {
    super(options);
    this.#acquire = acquire;
    this.#decoder = options.decoder;
    this.#mappings = options.mappings;
    this.#reducer = new SnapshotReducer(options.reducer);
    this.#mutable = mutable;
  }

  #initialize() {
    if (this.#state) return this.#state;
    const generation = this.#acquisitionGeneration;
    return (this.#state = Promise.resolve(this.#acquire())
      .then((payload) => canonicalize(payload, this.#decoder, this.#mappings))
      .then((rows) => {
        if (generation !== this.#acquisitionGeneration) throw new Error('Stale snapshot acquisition');
        this.#rows = rows;
        this.#reducer.reset(rows);
      }));
  }

  async query(chunk: TimescopeChunk) {
    await this.#initialize();
    return this.#reducer.query(chunk);
  }

  override invalidate(range?: TimescopeRange<Decimal | undefined>) {
    if (!this.#mutable) {
      this.#acquisitionGeneration++;
      this.#state = undefined;
      this.#rows = [];
      this.#reducer.reset([]);
      super.invalidate();
      return;
    }
    super.invalidate(range);
  }

  async append(input: Row | readonly Row[]) {
    if (!this.#mutable) throw new Error('Only data snapshot sources are mutable');
    await this.#initialize();
    const rows = normalizeDataRows(Array.isArray(input) ? input : [input], this.#mappings);
    const changed = rowRange(rows);
    if (!changed) return;
    const dirty = mutationRange(this.#rows, changed, rows);
    this.#rows.push(...rows);
    this.#reducer.append(rows, this.#rows);
    this.invalidate(dirty);
  }

  async replace(rangeInput: TimescopeRange<TimeLike<never>>, input: Row | readonly Row[]) {
    if (!this.#mutable) throw new Error('Only data snapshot sources are mutable');
    await this.#initialize();
    const range = rangeInput.map((value) => parseTimeLike<never>(value)) as TimescopeRange<Decimal>;
    if (range[1].lt(range[0])) throw new RangeError('Replacement range end must not precede its start');
    const rows = normalizeDataRows(Array.isArray(input) ? input : [input], this.#mappings);
    if (rows.some((row) => !rowIntersectsRange(row, range))) {
      throw new RangeError('Replacement rows must intersect the replacement range');
    }
    const dirty = mutationRange(this.#rows, range, rows);
    this.#rows = this.#rows.filter((row) => {
      const [start, end] = row.range;
      return start.eq(end) ? start.lt(range[0]) || start.ge(range[1]) : end.le(range[0]) || start.ge(range[1]);
    });
    this.#rows.push(...rows);
    this.#reducer.replace(range, rows, this.#rows);
    this.invalidate(dirty);
  }
}

class ChunkedDataSource<Row> extends TimescopeDataSourceBase<Row> {
  #acquire: (chunk: TimescopeChunk, context: TimescopeChunkLoaderContext) => unknown | Promise<unknown>;
  #decoder?: TimescopeDataDecoder;
  #mappings?: TimescopeMappings;

  constructor(
    options: DataSourceOptions,
    acquire: (chunk: TimescopeChunk, context: TimescopeChunkLoaderContext) => unknown | Promise<unknown>,
  ) {
    super(options);
    this.#acquire = acquire;
    this.#decoder = options.decoder;
    this.#mappings = options.mappings;
  }

  async query(chunk: TimescopeChunk, context: TimescopeChunkLoaderContext) {
    return canonicalize(await this.#acquire(chunk, context), this.#decoder, this.#mappings);
  }
}

function isDataSource(value: unknown): value is TimescopeDataSource<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as TimescopeDataSource).query === 'function' &&
    typeof (value as TimescopeDataSource).invalidate === 'function' &&
    typeof (value as TimescopeDataSource).on === 'function' &&
    typeof (value as TimescopeDataSource).revision === 'number'
  );
}

type InputRow<S> =
  S extends TimescopeDataSource<infer Row>
    ? Row
    : S extends { decoder: (...args: any[]) => infer Result }
      ? Awaited<Result> extends readonly (infer Row)[]
        ? Row
        : TimescopeDataRowInput
      : S extends { loader: (...args: any[]) => infer Result }
        ? Awaited<Result> extends readonly (infer Row)[]
          ? Row
          : TimescopeDataRowInput
        : S extends (...args: any[]) => infer Result
          ? Awaited<Result> extends readonly (infer Row)[]
            ? Row
            : TimescopeDataRowInput
          : S extends { data: readonly (infer Row)[] }
            ? Row
            : S extends readonly (infer Row)[]
              ? Row
              : TimescopeDataRowInput;

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends bigint
      ? bigint
      : T extends readonly (infer V)[]
        ? Widen<V>[]
        : T extends object
          ? { [K in keyof T]: Widen<T[K]> }
          : T;

type OutputShape<S> = S extends { mappings: infer M extends TimescopeMappings }
  ? { times: M['times']; values: M['values'] }
  : InputRow<S>;
type InputTimesKey<S> =
  OutputShape<S> extends { times: infer T extends Record<string, unknown> } ? string & keyof T : 'time';
type InputValuesKey<S> =
  OutputShape<S> extends { values: infer V extends Record<string, unknown> } ? string & keyof V : 'value';
type SnapshotOutputKey<S, K extends string> = S extends { reducer: 'min-max-avg' }
  ? K | `${K}#${'avg' | 'first' | 'last' | 'min' | 'max'}`
  : S extends { reducer: 'percentiles' | { type: 'percentiles' } }
    ? K | `${K}#${'first' | 'last' | 'min' | 'max' | 'p50' | 'p90' | 'p95'}`
    : K;
type OutputKey<S> = S extends (...args: any[]) => any
  ? InputValuesKey<S>
  : S extends string
    ? S extends `${string}{${string}}${string}`
      ? InputValuesKey<S>
      : SnapshotOutputKey<S, InputValuesKey<S>>
    : S extends { url: infer U extends string }
      ? U extends `${string}{${string}}${string}`
        ? InputValuesKey<S>
        : SnapshotOutputKey<S, InputValuesKey<S>>
      : S extends { loader: unknown }
        ? S extends { chunked: false }
          ? SnapshotOutputKey<S, InputValuesKey<S>>
          : InputValuesKey<S>
        : SnapshotOutputKey<S, InputValuesKey<S>>;
type SourceOutputRow<S> = {
  times: Record<InputTimesKey<S>, unknown>;
  values: Record<OutputKey<S>, unknown>;
  data?: InputRow<S> extends { data?: infer Data } ? Data : undefined;
};

export function createDataSource<const S extends TimescopeDataSource<any>>(value: S): S;
export function createDataSource<const S extends readonly TimescopeDataRowInput[]>(
  value: S,
): TimescopeMutableDataSource<SourceOutputRow<S>, Widen<InputRow<S>>>;
export function createDataSource<const S extends { data: unknown }>(
  value: S,
): TimescopeMutableDataSource<SourceOutputRow<S>, Widen<InputRow<S>>>;
export function createDataSource<const S extends TimescopeSourceInput>(
  value: S,
): TimescopeDataSource<SourceOutputRow<S>>;
export function createDataSource(value: TimescopeSourceInput | TimescopeDataSource<any>): TimescopeDataSource<any> {
  if (!Array.isArray(value) && isDataSource(value)) return value;
  const options: DataSourceOptions =
    typeof value === 'string'
      ? { url: value }
      : typeof value === 'function'
        ? { loader: value }
        : Array.isArray(value)
          ? { data: value }
          : (value as DataSourceOptions);
  const acquisitions = ['loader', 'url', 'data'].filter((key) => key in options);
  if (acquisitions.length !== 1) throw new Error('A source must specify exactly one of loader, url, or data');
  if ('decoder' in options && 'mappings' in options) throw new Error('A decoder cannot be combined with mappings');
  if (options.reducer === null || Array.isArray(options.reducer)) {
    throw new Error("Use reducer: 'null' for raw snapshot data");
  }

  if ('data' in options) return new SnapshotDataSource(options, () => options.data, true);
  if (typeof options.url === 'string') {
    const url = options.url;
    if (!/{[a-zA-Z]+}/.test(url)) return new SnapshotDataSource(options, () => fetch(url), false);
    if ('reducer' in options) throw new Error('Chunked sources cannot specify a reducer');
    return new ChunkedDataSource(options, (chunk) => fetch(resolveUrl(url, chunk)));
  }
  const loader = options.loader;
  if (typeof loader !== 'function') throw new Error('A source loader must be a function');
  if (options.chunked === false)
    return new SnapshotDataSource(options, () => (loader as TimescopeSnapshotLoader)(), false);
  if ('reducer' in options) throw new Error('Chunked sources cannot specify a reducer');
  return new ChunkedDataSource(options, loader as TimescopeChunkLoader<unknown>);
}

const stores = new WeakMap<object, TimescopeChunkStore<TimescopeDataRow>>();

export function chunkStoreForDataSource(source: TimescopeDataSource<any>) {
  let store = stores.get(source as object);
  if (!store) {
    store = new TimescopeChunkStore(source);
    stores.set(source as object, store);
  }
  return store;
}

type InternedView = { view: TimescopeView<TimescopeDataRow>; references: number; release: () => void };
const viewsBySource = new WeakMap<object, WeakMap<TimescopeViewRegistry, Map<string, InternedView>>>();
const internedViews = new WeakMap<TimescopeView<TimescopeDataRow>, InternedView>();

export function requestViewForDataSource(
  source: TimescopeDataSource<any>,
  context: TimescopeViewRegistry,
  request: TimescopeViewRequest,
) {
  let byContext = viewsBySource.get(source as object);
  if (!byContext) viewsBySource.set(source as object, (byContext = new WeakMap()));
  let views = byContext.get(context);
  if (!views) byContext.set(context, (views = new Map()));
  const key = timescopeViewRequestKey(request);
  let entry = views.get(key);
  if (!entry) {
    const view = new TimescopeView(
      chunkStoreForDataSource(source),
      context,
      {
        chunkSize: source.chunkSize,
        chunkOffset: source.chunkOffset,
        resolutions: source.resolutions,
      },
      request,
    );
    entry = { view, references: 0, release: () => views.delete(key) };
    views.set(key, entry);
    internedViews.set(view, entry);
  }
  entry.references++;
  return entry.view;
}

export function releaseViewForDataSource(view: TimescopeView<TimescopeDataRow>) {
  const entry = internedViews.get(view);
  if (!entry) return;
  entry.references--;
  if (entry.references > 0) return;
  entry.release();
  internedViews.delete(view);
  view.dispose();
}
