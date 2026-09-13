import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type { TimescopeReducer as ReducerOptions, TimescopePercentilesReducer } from '#src/main/TimescopeDataSource';
import { TimescopeAggregateSeriesIndex } from '#src/main/reducers/TimescopeAggregateSeriesIndex';
import { TimescopeStaticSeriesIndex } from '#src/main/reducers/TimescopeStaticSeriesIndex';

/** A snapshot's reduction strategy and its query/update index. */
export class TimescopeReducer {
  #kind: 'null' | 'min-max-avg' | 'percentiles';
  #percentiles?: TimescopePercentilesReducer;
  #rows: readonly TimescopeDataRow[] = [];
  #index: TimescopeAggregateSeriesIndex | TimescopeStaticSeriesIndex;

  constructor(options?: ReducerOptions) {
    if (options === undefined || options === 'null') this.#kind = 'null';
    else if (options === 'min-max-avg') this.#kind = 'min-max-avg';
    else if (options === 'percentiles' || (typeof options === 'object' && options?.type === 'percentiles')) {
      this.#kind = 'percentiles';
    } else throw new Error('Invalid snapshot reducer');
    this.#percentiles = typeof options === 'object' ? options : undefined;
    this.#index = this.#createIndex();
  }

  #createIndex() {
    return this.#kind === 'percentiles'
      ? new TimescopeStaticSeriesIndex(this.#rows, true)
      : new TimescopeAggregateSeriesIndex(this.#rows);
  }

  reset(rows: readonly TimescopeDataRow[]) {
    this.#rows = rows;
    this.#index = this.#createIndex();
  }

  append(rows: TimescopeDataRow[], allRows: readonly TimescopeDataRow[]) {
    this.#rows = allRows;
    if (this.#index instanceof TimescopeAggregateSeriesIndex) this.#index.append(rows);
    else this.#index = this.#createIndex();
  }

  replace(range: TimescopeRange<Decimal>, rows: TimescopeDataRow[], allRows: readonly TimescopeDataRow[]) {
    this.#rows = allRows;
    if (this.#index instanceof TimescopeAggregateSeriesIndex) this.#index.replaceRange(range, rows);
    else this.#index = this.#createIndex();
  }

  query(chunk: TimescopeChunk): TimescopeDataRow[] {
    const rows =
      this.#kind === 'null' ? (this.#index as TimescopeAggregateSeriesIndex).queryRaw(chunk) : this.#index.query(chunk);
    if (!this.#percentiles) return rows;
    const values = this.#percentiles.values ?? [0.5, 0.9, 0.95];
    const primary = this.#percentiles.primary ?? 0.5;
    const allowed = new Set(values.map((value) => `p${value * 100}`));
    allowed.add(`p${primary * 100}`);
    const valueKeys = new Set(this.#rows.flatMap((row) => Object.keys(row.values)));
    return rows.map((row) => {
      const next = { ...row.values };
      for (const key of Object.keys(next)) {
        const suffix = key.split('#').at(-1)!;
        if (/^p\d+$/.test(suffix) && !allowed.has(suffix)) delete next[key];
      }
      for (const key of valueKeys) next[key] = next[`${key}#p${primary * 100}`] ?? null;
      return { ...row, values: next };
    });
  }
}
