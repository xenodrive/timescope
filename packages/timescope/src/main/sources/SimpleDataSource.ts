import { TimescopeStaticSeriesIndex } from '#src/main/reducers/TimescopeStaticSeriesIndex';
import type { TimescopeDataRow, TimescopeDataRowInput } from '#src/main/TimescopeData';
import type { TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';
import { LoadedDataSource } from './LoadedDataSource.ts';

/** Unaggregated point/interval queries, from a snapshot or a range loader. */
export class SimpleDataSource<Row = TimescopeDataRowInput> extends LoadedDataSource<TimescopeStaticSeriesIndex, Row> {
  protected createIndex(rows: readonly TimescopeDataRow[]) {
    return new TimescopeStaticSeriesIndex(rows);
  }
  async query(request: TimescopeDataSourceQuery) {
    this.checkQuery(request);
    if (!this.loader.ranged) return (await this.getIndex()).query(request);
    return this.loader.load(request);
  }
}
