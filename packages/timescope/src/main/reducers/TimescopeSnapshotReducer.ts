import type { TimescopeChunk } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeAggregateSeriesIndex } from '#src/main/reducers/TimescopeAggregateSeriesIndex';
import { TimescopeStaticSeriesIndex } from '#src/main/reducers/TimescopeStaticSeriesIndex';
import type { TimescopeDataRow } from '#src/main/TimescopeData';

export type TimescopePercentilesReducer = {
  type: 'percentiles';
  values?: readonly (0.5 | 0.9 | 0.95)[];
  primary?: 0.5 | 0.9 | 0.95;
};
export type TimescopeReducer = 'min-max-avg' | 'percentiles' | 'null' | TimescopePercentilesReducer;

/** A snapshot's reduction strategy and its query/update index. */
export class TimescopeSnapshotReducer {
  #kind: 'null' | 'min-max-avg' | 'percentiles';
  #percentiles?: TimescopePercentilesReducer;
  #rows: TimescopeDataRow[] = [];
  #index?: TimescopeAggregateSeriesIndex | TimescopeStaticSeriesIndex;

  constructor(options?: TimescopeReducer) {
    if (options === undefined || options === 'null') this.#kind = 'null';
    else if (options === 'min-max-avg') this.#kind = 'min-max-avg';
    else if (options === 'percentiles' || (typeof options === 'object' && options?.type === 'percentiles')) {
      this.#kind = 'percentiles';
    } else throw new Error('Invalid snapshot reducer');
    this.#percentiles = typeof options === 'object' ? options : undefined;
  }

  #createIndex() {
    return this.#kind === 'percentiles'
      ? new TimescopeStaticSeriesIndex(this.#rows, true)
      : new TimescopeAggregateSeriesIndex(this.#rows);
  }

  get rows(): readonly TimescopeDataRow[] {
    return this.#rows;
  }

  reset(rows: readonly TimescopeDataRow[]) {
    this.#rows = [...rows];
    this.#index = undefined;
  }

  append(rows: TimescopeDataRow[]) {
    this.#rows.push(...rows);
    if (this.#index instanceof TimescopeAggregateSeriesIndex) this.#index.append(rows);
    else this.#index = undefined;
  }

  replace(range: TimescopeRange<Decimal>, rows: TimescopeDataRow[]) {
    this.#rows = this.#rows.filter(({ range: [start, end] }) =>
      start.eq(end) ? start.lt(range[0]) || start.ge(range[1]) : end.le(range[0]) || start.ge(range[1]),
    );
    this.#rows.push(...rows);
    if (this.#index instanceof TimescopeAggregateSeriesIndex) this.#index.replaceRange(range, rows);
    else this.#index = undefined;
  }

  query(chunk: TimescopeChunk): TimescopeDataRow[] {
    this.#index ??= this.#createIndex();
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
