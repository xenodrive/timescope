import { TimescopeSegmentSeriesIndex } from '#src/main/reducers/TimescopeSegmentSeriesIndex';
import { normalizeDataRows, type TimescopeDataRow, type TimescopeDataRowInput } from '#src/main/TimescopeData';
import type {
  TimescopeAppendOnlyDataSource,
  TimescopeSourceOptions,
  TimescopeDataSourceQuery,
} from '#src/main/TimescopeDataSource';
import { LoadedDataSource } from './LoadedDataSource';
import { aggregateQuery } from './query';

/** Min/max/avg over nondecreasing point times, with append-only updates. */
export class PointAggregateDataSource<Row = TimescopeDataRowInput, Input = Row>
  extends LoadedDataSource<TimescopeSegmentSeriesIndex, Row>
  implements TimescopeAppendOnlyDataSource<Row, Input>
{
  constructor(options: Extract<TimescopeSourceOptions, { type: 'point-aggregate' }>) {
    super(options);
    if (this.loader.ranged) throw new Error('Point aggregation requires a snapshot loader');
  }
  protected createIndex(rows: readonly TimescopeDataRow[]) {
    return new TimescopeSegmentSeriesIndex(rows);
  }
  async query(request: TimescopeDataSourceQuery) {
    this.checkQuery(request);
    return (await this.getIndex()).query(aggregateQuery(request, this.chunkOrigin));
  }
  async append(input: Input | readonly Input[]) {
    const index = await this.getIndex();
    if (this.disposed) throw new Error('DataSource is disposed');
    const rows = normalizeDataRows(Array.isArray(input) ? input : [input], this.options.mappings);
    if (!rows.length) return;
    const before = index.previousTime(rows[0].range[0]);
    index.append(rows);
    this.notifyChanged([before, undefined]);
  }
}
