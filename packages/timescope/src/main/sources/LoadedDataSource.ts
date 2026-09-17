import type { TimescopeRange } from '#src/core/range';
import type { TimeLike } from '#src/core/time';
import type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
import { createDataLoader, type TimescopeDataLoader } from '#src/main/TimescopeDataLoader';
import type { TimescopeSourceOptions, TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';
import { TimescopeDataSourceBase } from '#src/main/TimescopeDataSourceBase';
import { validateQuery } from './query';

/** Loader-backed snapshot/index lifecycle, independent of query-result caching. */
export abstract class LoadedDataSource<Index, Row = TimescopeDataRowInput> extends TimescopeDataSourceBase<Row> {
  protected readonly loader: TimescopeDataLoader;
  protected readonly options: TimescopeSourceOptions;
  protected disposed = false;
  #snapshot?: Promise<Index>;
  #generation = 0;

  constructor(options: TimescopeSourceOptions) {
    super(options);
    this.options = options;
    this.loader = createDataLoader(options);
  }

  override get resolutions() {
    return this.loader.ranged ? this.loaderResolutions : undefined;
  }
  protected abstract createIndex(rows: readonly TimescopeDataRow[]): Index;
  protected checkQuery(request: TimescopeDataSourceQuery) {
    if (this.disposed) throw new Error('DataSource is disposed');
    validateQuery(request);
  }
  protected getIndex(): Promise<Index> {
    if (this.disposed) return Promise.reject(new Error('DataSource is disposed'));
    if (!this.#snapshot) {
      const generation = this.#generation;
      const state = this.loader
        .load()
        .then((rows) => {
          if (this.disposed || generation !== this.#generation) throw new Error('Stale snapshot acquisition');
          return this.createIndex(rows);
        })
        .catch((error) => {
          if (this.#snapshot === state) this.#snapshot = undefined;
          throw error;
        });
      this.#snapshot = state;
    }
    return this.#snapshot;
  }
  /** Notify consumers after an in-place update, without reacquiring the snapshot. */
  protected notifyChanged(range?: TimescopeRange<TimeLike<undefined>>) {
    super.invalidate(range);
  }
  override invalidate(range?: TimescopeRange<TimeLike<undefined>>) {
    if (!this.loader.ranged) {
      this.#generation++;
      this.#snapshot = undefined;
      // A snapshot can only be reacquired as a whole.
      range = undefined;
    }
    this.notifyChanged(range);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.#generation++;
    this.#snapshot = undefined;
    this.notifyChanged();
  }
}
