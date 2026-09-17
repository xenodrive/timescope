export * from '#src/main/options';
export { Timescope } from '#src/main/Timescope';
export {
  createDataLoader,
  TimescopeDataLoader,
  type TimescopeDataLoaderOptions,
  type TimescopeLoadRequest,
  type TimescopeRangeLoader,
  type TimescopeSnapshotLoader,
} from '#src/main/TimescopeDataLoader';
export {
  TimescopeDataSourceBase,
  createDataSource,
  type TimescopeDataSource,
  type TimescopeDataSourceInvalidation,
  type TimescopeDataSourceQuery,
  type TimescopeAppendOnlyDataSource,
} from '#src/main/TimescopeDataSource';
export { Calendar } from '@kikuchan/calendar';
export { Decimal } from '@kikuchan/decimal';

// types
export type { TimescopeAnimationInput } from '#src/core/animation';
export type { TimescopeChunk } from '#src/core/chunk';
export { SimpleDataSource } from '#src/main/sources/SimpleDataSource';
export { PointAggregateDataSource } from '#src/main/sources/PointAggregateDataSource';
export { PointPercentileDataSource } from '#src/main/sources/PointPercentileDataSource';
export type { TimescopeRange } from '#src/core/range';
export type { TimescopeOptions, TimescopeOptionsInitial } from '#src/main/options';
export type * from '#src/main/Timescope';
export type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
export type { DecimalLike } from '@kikuchan/decimal';
