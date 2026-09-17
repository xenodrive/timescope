import type { Decimal, NumberLike } from '#src/core/decimal';
import type { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimeLike } from '#src/core/time';
import { PointAggregateDataSource } from '#src/main/sources/PointAggregateDataSource';
import { PointPercentileDataSource } from '#src/main/sources/PointPercentileDataSource';
import { SimpleDataSource } from '#src/main/sources/SimpleDataSource';
import type { TimescopeDataRow, TimescopeDataRowInput, TimescopeMappings } from '#src/main/TimescopeData';
import type {
  TimescopeDataAcquisition,
  TimescopeDataTransform,
  TimescopeRangeLoader,
  TimescopeSnapshotAcquisition,
} from '#src/main/TimescopeDataLoader';
import type { TimescopeView, TimescopeViewRegistry, TimescopeViewRequest } from '#src/main/TimescopeView';
export { TimescopeDataSourceBase } from '#src/main/TimescopeDataSourceBase';
export { chunkStoreForDataSource, requestViewForDataSource, releaseViewForDataSource } from '#src/main/sourceViews';
export type { TimescopeDataDecoder, TimescopeSnapshotLoader } from '#src/main/TimescopeDataLoader';

export type TimescopeSourceCommonOptions = {
  reducer?: never;
  index?: never;
  mutation?: never;
  /** Retention hint for the display-side ChunkStore. */
  cacheSize?: number;
  /** Preferred query tiling; direct queries need not align with it. */
  chunkSize?: number;
  chunkOrigin?: NumberLike;
  immediate?: boolean;
  /** Preferred loader resolutions; arbitrary direct queries remain valid. */
  resolutions?: readonly NumberLike[];
  zoomLevels?: readonly number[];
};
export type TimescopePercentileOptions = {
  values?: readonly (0.5 | 0.9 | 0.95)[];
  primary?: 0.5 | 0.9 | 0.95;
};
export type TimescopeSourceOptions = TimescopeSourceCommonOptions &
  TimescopeDataTransform &
  (
    | (TimescopeDataAcquisition & { type?: 'simple' })
    | (TimescopeSnapshotAcquisition & { type: 'point-aggregate' })
    | (TimescopeSnapshotAcquisition & { type: 'point-percentile'; percentiles?: TimescopePercentileOptions })
  );
export type TimescopeSourceInput =
  | string
  | readonly TimescopeDataRowInput[]
  | TimescopeRangeLoader<readonly TimescopeDataRowInput[]>
  | TimescopeSourceOptions
  | TimescopeDataSource<any>;
export type TimescopeOptionsSources<S extends Record<string, TimescopeSourceInput>> = { [K in keyof S]: S[K] };

type InferReturnedRow<T> = Awaited<T> extends readonly (infer R)[] ? R : TimescopeDataRowInput;
export type InferSourceRow<S> =
  S extends TimescopeDataSource<infer R>
    ? R
    : S extends { mappings: infer M extends TimescopeMappings }
      ? { times: M['times']; values: M['values'] }
      : S extends { decoder: (...args: any[]) => infer R }
        ? InferReturnedRow<R>
        : S extends { loader: (...args: any[]) => infer R }
          ? InferReturnedRow<R>
          : S extends (...args: any[]) => infer R
            ? InferReturnedRow<R>
            : S extends { data: readonly (infer R)[] }
              ? R
              : S extends readonly (infer R)[]
                ? R
                : TimescopeDataRowInput;
export type InferTimesKey<R> = R extends { times: infer T extends Record<string, unknown> } ? string & keyof T : 'time';
type RawValueKey<R> = R extends { values: infer V extends Record<string, unknown> } ? string & keyof V : 'value';
export type InferSourceData<S> = InferSourceRow<S> extends { data?: infer D } ? D : undefined;
export type InferSourceValueKey<S> =
  RawValueKey<InferSourceRow<S>> extends infer K extends string
    ? S extends { type: 'point-aggregate' }
      ? K | `${K}#${'avg' | 'first' | 'last' | 'min' | 'max'}`
      : S extends { type: 'point-percentile' }
        ? K | `${K}#${'first' | 'last' | 'min' | 'max' | 'p50' | 'p90' | 'p95'}`
        : K
    : never;

export type TimescopeDataSourceInvalidation = { range?: TimescopeRange<Decimal | undefined>; revision: number };
/** An arbitrary finite range and positive resolution, with no chunk identity. */
export type TimescopeDataSourceQuery = { range: TimescopeRange<Decimal>; resolution: Decimal };
export interface TimescopeDataSource<Row = TimescopeDataRowInput> extends Pick<
  TimescopeObservable<TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>>,
  'on' | 'revision'
> {
  readonly chunkSize: number;
  readonly chunkOrigin: Decimal;
  readonly resolutions?: readonly Decimal[];
  readonly immediate: boolean;
  readonly cacheSize?: number;
  readonly invalidation?: TimescopeDataSourceInvalidation;
  readonly outputRow?: Row;
  query(request: TimescopeDataSourceQuery): Promise<readonly TimescopeDataRow[]>;
  invalidate(range?: TimescopeRange<TimeLike<undefined>>): void;
  dispose?(): void;
  requestView?(context: TimescopeViewRegistry, request: TimescopeViewRequest): TimescopeView<TimescopeDataRow>;
  releaseView?(view: TimescopeView<TimescopeDataRow>): void;
}
export interface TimescopeAppendOnlyDataSource<
  Row = TimescopeDataRowInput,
  Input = Row,
> extends TimescopeDataSource<Row> {
  append(rows: Input | readonly Input[]): Promise<void>;
}
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
type InputRow<S> = S extends { decoder: (...args: any[]) => infer R }
  ? InferReturnedRow<R>
  : S extends { data: readonly (infer R)[] }
    ? R
    : InferSourceRow<S>;
type SourceOutputRow<S> = {
  times: Record<InferTimesKey<InferSourceRow<S>>, unknown>;
  values: Record<InferSourceValueKey<S>, unknown>;
  data?: InferSourceData<S>;
};

function isDataSource(value: unknown): value is TimescopeDataSource<any> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as TimescopeDataSource).query === 'function' &&
    typeof (value as TimescopeDataSource).invalidate === 'function' &&
    typeof (value as TimescopeDataSource).on === 'function'
  );
}
export function createDataSource<const S extends TimescopeDataSource<any>>(value: S): S;
export function createDataSource<const S extends Extract<TimescopeSourceOptions, { type: 'point-aggregate' }>>(
  value: S,
): TimescopeAppendOnlyDataSource<SourceOutputRow<S>, Widen<InputRow<S>>>;
export function createDataSource<const S extends TimescopeSourceInput>(
  value: S,
): TimescopeDataSource<SourceOutputRow<S>>;
export function createDataSource(value: TimescopeSourceInput): TimescopeDataSource<any> {
  if (isDataSource(value)) return value;
  const options: TimescopeSourceOptions =
    typeof value === 'string'
      ? { url: value }
      : typeof value === 'function'
        ? { loader: value }
        : Array.isArray(value)
          ? { data: value }
          : (value as TimescopeSourceOptions);
  if ('reducer' in options || 'index' in options || 'mutation' in options)
    throw new Error('Select a DataSource with type');
  switch (options.type) {
    case undefined:
    case 'simple':
      return new SimpleDataSource(options);
    case 'point-aggregate':
      return new PointAggregateDataSource(options);
    case 'point-percentile':
      return new PointPercentileDataSource(options);
    default:
      throw new Error('Invalid source type');
  }
}
