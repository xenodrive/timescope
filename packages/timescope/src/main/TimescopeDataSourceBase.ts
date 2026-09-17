import { DEFAULT_CHUNK_SIZE } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeLike, type TimeLike } from '#src/core/time';
import { resolutionFor } from '#src/core/zoom';
import { requestViewForDataSource, releaseViewForDataSource } from '#src/main/sourceViews';
import type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
import type {
  TimescopeDataSource,
  TimescopeDataSourceInvalidation,
  TimescopeDataSourceQuery,
  TimescopeSourceCommonOptions,
} from '#src/main/TimescopeDataSource';
import type { TimescopeView, TimescopeViewRegistry, TimescopeViewRequest } from '#src/main/TimescopeView';

export abstract class TimescopeDataSourceBase<Row = TimescopeDataRowInput>
  extends TimescopeObservable<TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>>
  implements TimescopeDataSource<Row>
{
  readonly chunkSize: number;
  readonly chunkOrigin: Decimal;
  readonly immediate: boolean;
  readonly cacheSize: number;
  protected readonly loaderResolutions?: readonly Decimal[];
  declare readonly outputRow?: Row;
  #invalidation?: TimescopeDataSourceInvalidation;

  constructor(options: TimescopeSourceCommonOptions = {}) {
    super();
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    if (!Number.isSafeInteger(this.chunkSize) || this.chunkSize <= 0)
      throw new RangeError('Chunk size must be a positive integer');
    this.chunkOrigin = Decimal(options.chunkOrigin ?? 0);
    this.loaderResolutions =
      options.resolutions?.map((value) => Decimal(value)) ?? options.zoomLevels?.map(resolutionFor);
    if (this.loaderResolutions?.some((value) => value.le(0))) throw new RangeError('Resolutions must be positive');
    this.immediate = options.immediate ?? true;
    this.cacheSize = options.cacheSize ?? 1000;
    if (!Number.isSafeInteger(this.cacheSize) || this.cacheSize < 0)
      throw new RangeError('cacheSize must be a nonnegative integer');
  }
  get resolutions() {
    return this.loaderResolutions;
  }
  abstract query(request: TimescopeDataSourceQuery): Promise<readonly TimescopeDataRow[]>;
  requestView(context: TimescopeViewRegistry, request: TimescopeViewRequest) {
    return requestViewForDataSource(this, context, request);
  }
  releaseView(view: TimescopeView<TimescopeDataRow>) {
    releaseViewForDataSource(view);
  }
  get invalidation() {
    return this.#invalidation;
  }
  invalidate(input?: TimescopeRange<TimeLike<undefined>>) {
    const range = input?.map((time) => (time === undefined ? undefined : parseTimeLike(time))) as
      | TimescopeRange<Decimal | undefined>
      | undefined;
    if (range?.[0] && range[1] && range[1].lt(range[0])) throw new RangeError('Invalidation range must be ordered');
    this.changed();
    this.#invalidation = { range, revision: this.revision };
    this.dispatchEvent(new TimescopeEvent('invalidate', this.#invalidation));
  }
}
