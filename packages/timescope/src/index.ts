export * from '#src/main/options';
export { Timescope } from '#src/main/Timescope';
export {
  TimescopeDataSourceBase,
  createDataSource,
  type TimescopeDataSource,
  type TimescopeDataSourceInvalidation,
  type TimescopeMutableDataSource,
} from '#src/main/TimescopeDataSource';
export { Calendar } from '@kikuchan/calendar';
export { Decimal } from '@kikuchan/decimal';

// types
export type { TimescopeAnimationInput } from '#src/core/animation';
export type { TimescopeChunk, TimescopeChunkLoaderContext } from '#src/core/chunk';
export type { TimescopeRange } from '#src/core/range';
export type { TimescopeOptions, TimescopeOptionsInitial } from '#src/main/options';
export type * from '#src/main/Timescope';
export type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
export type { DecimalLike } from '@kikuchan/decimal';
