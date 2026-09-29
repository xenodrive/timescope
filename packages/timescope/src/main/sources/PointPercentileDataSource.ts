import { TimescopeStaticSeriesIndex } from '#src/main/reducers/TimescopeStaticSeriesIndex';
import type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
import type { TimescopeSourceOptions, TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';
import { LoadedDataSource } from './LoadedDataSource.ts';
import { aggregateQuery } from './query.ts';

/** Snapshot point percentiles. The static value index is built once per acquisition. */
export class PointPercentileDataSource<Row = TimescopeDataRowInput> extends LoadedDataSource<
  TimescopeStaticSeriesIndex,
  Row
> {
  #primary: 0.5 | 0.9 | 0.95;
  #suffixes: Set<string>;
  constructor(options: Extract<TimescopeSourceOptions, { type: 'point-percentile' }>) {
    super(options);
    if (this.loader.ranged) throw new Error('Point percentiles require a snapshot loader');
    this.#primary = options.percentiles?.primary ?? 0.5;
    const values = options.percentiles?.values ?? [0.5, 0.9, 0.95];
    if ([...values, this.#primary].some((value) => ![0.5, 0.9, 0.95].includes(value)))
      throw new RangeError('Unsupported percentile');
    this.#suffixes = new Set([...values, this.#primary].map((value) => `p${value * 100}`));
  }
  protected createIndex(rows: readonly TimescopeDataRow[]) {
    if (rows.some((row) => !row.range[0].eq(row.range[1]))) throw new Error('Point percentiles accept only point rows');
    return new TimescopeStaticSeriesIndex(rows, true);
  }
  async query(request: TimescopeDataSourceQuery) {
    this.checkQuery(request);
    return (await this.getIndex()).query(aggregateQuery(request, this.chunkOrigin)).map((row) => {
      const values = { ...row.values };
      for (const key of Object.keys(row.values)) {
        if (key.endsWith(`#p${this.#primary * 100}`)) values[key.slice(0, key.lastIndexOf('#'))] = row.values[key];
        const suffix = key.split('#').at(-1)!;
        if (/^p\d+$/.test(suffix) && !this.#suffixes.has(suffix)) delete values[key];
      }
      return { ...row, values };
    });
  }
}
