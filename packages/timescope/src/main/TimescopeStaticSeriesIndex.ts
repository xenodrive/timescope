import type { TimescopeChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import { IntervalTree } from '#src/core/interval';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import { TimescopeStaticValueIndex } from '#src/main/static/TimescopeStaticValueIndex';

type IndexedRow = { ordinal: number; row: TimescopeDataRow };
const aggregateSuffixes = ['first', 'last', 'min', 'max', 'p50', 'p90', 'p95'] as const;

function lowerBound(entries: readonly IndexedRow[], time: Decimal, left = 0) {
  let right = entries.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (entries[middle].row.range[0].lt(time)) left = middle + 1;
    else right = middle;
  }
  return left;
}

function aggregateValues(indexes: ReadonlyMap<string, TimescopeStaticValueIndex>, left: number, right: number) {
  const result: Record<string, Decimal | null> = {};
  for (const [key, index] of indexes) {
    const aggregate = index.aggregate(left, right);
    result[key] = aggregate.p50;
    for (const suffix of aggregateSuffixes) result[`${key}#${suffix}`] = aggregate[suffix];
  }
  return result;
}

function aggregateBucket(
  entries: readonly IndexedRow[],
  indexes: ReadonlyMap<string, TimescopeStaticValueIndex>,
  left: number,
  right: number,
  range: TimescopeRange<Decimal>,
): TimescopeDataRow {
  const first = entries[left].row;
  if (right - left === 1) return { ...first, values: aggregateValues(indexes, left, right) };

  const midpoint = range[0].add(range[1]).div(2);
  return {
    times: Object.fromEntries(Object.keys(first.times).map((key) => [key, midpoint])),
    values: aggregateValues(indexes, left, right),
    data: undefined,
    range: [range[0], range[1], '[)'],
  };
}

export class TimescopeStaticSeriesIndex {
  #entries: IndexedRow[];
  #points: IndexedRow[];
  #intervalEntries: IndexedRow[];
  #intervals = new IntervalTree<IndexedRow>();
  #valueIndexes = new Map<string, TimescopeStaticValueIndex>();
  #reduce: boolean;

  constructor(rows: readonly TimescopeDataRow[], reduce = false) {
    this.#reduce = reduce;
    this.#entries = rows
      .map((row, ordinal) => ({ row, ordinal }))
      .toSorted((a, b) => a.row.range[0].cmp(b.row.range[0]) || a.ordinal - b.ordinal);
    this.#points = this.#entries.filter((entry) => entry.row.range[0].eq(entry.row.range[1]));
    this.#intervalEntries = this.#entries.filter((entry) => entry.row.range[0].neq(entry.row.range[1]));
    this.#intervals.bulkInsert(this.#intervalEntries, (entry) => [
      entry.row.range[0],
      entry.row.range[1],
      entry.row.range[2],
    ]);

    if (reduce) {
      const keys = new Set(this.#points.flatMap((entry) => Object.keys(entry.row.values)));
      for (const key of keys) {
        this.#valueIndexes.set(key, new TimescopeStaticValueIndex(this.#points.map((entry) => entry.row.values[key])));
      }
    }
  }

  query(chunk: TimescopeChunk) {
    const [start, end] = chunk.range;
    if (!start || !end) throw new RangeError('Chunk range must be finite');
    if (chunk.resolution.le(0)) throw new RangeError('Chunk resolution must be positive');
    return this.#reduce ? this.#queryReduced([start, end], chunk.resolution) : this.#queryRaw([start, end]);
  }

  #queryRaw([start, end]: TimescopeRange<Decimal>) {
    const selected = this.#intervals.query(start, end);
    const pointStart = lowerBound(this.#points, start);
    const pointEnd = lowerBound(this.#points, end, pointStart);
    for (let index = pointStart; index < pointEnd; index++) selected.add(this.#points[index]);

    const before = lowerBound(this.#entries, start);
    const after = lowerBound(this.#entries, end);
    let added = 0;
    for (let index = before - 1; index >= 0 && added < 2; index--) {
      const entry = this.#entries[index];
      if (selected.has(entry)) continue;
      selected.add(entry);
      added++;
    }
    added = 0;
    for (let index = after; index < this.#entries.length && added < 2; index++) {
      const entry = this.#entries[index];
      if (selected.has(entry)) continue;
      selected.add(entry);
      added++;
    }
    return [...selected]
      .toSorted((a, b) => a.row.range[0].cmp(b.row.range[0]) || a.ordinal - b.ordinal)
      .map((entry) => entry.row);
  }

  #queryReduced([start, end]: TimescopeRange<Decimal>, resolution: Decimal) {
    const first = lowerBound(this.#points, start);
    const last = lowerBound(this.#points, end, first);
    let left = first;
    const result: TimescopeDataRow[] = [];
    const addedBuckets = new Set<number>();
    let bucket = 0;
    for (let bucketStart = start; bucketStart.lt(end); bucketStart = bucketStart.add(resolution), bucket++) {
      const bucketEnd = bucketStart.add(resolution);
      const right = lowerBound(this.#points, bucketEnd, left);
      if (left < right) {
        result.push(aggregateBucket(this.#points, this.#valueIndexes, left, right, [bucketStart, bucketEnd]));
        addedBuckets.add(bucket);
      }
      left = right;
    }

    const contextBucket = (entry: IndexedRow | undefined) => {
      if (!entry) return;
      const bucketOffset = entry.row.range[0].sub(start).div(resolution).floor();
      const bucketStart = start.add(resolution.mul(bucketOffset));
      const bucketEnd = bucketStart.add(resolution);
      const bucketFirst = lowerBound(this.#points, bucketStart);
      const bucketLast = lowerBound(this.#points, bucketEnd, bucketFirst);
      if (bucketFirst < bucketLast) {
        const bucket = bucketOffset.number();
        return {
          bucket: Number.isSafeInteger(bucket) ? bucket : undefined,
          row: aggregateBucket(this.#points, this.#valueIndexes, bucketFirst, bucketLast, [bucketStart, bucketEnd]),
        };
      }
    };
    const contextStarts: Decimal[] = [];
    const addContext = (index: number, step: -1 | 1) => {
      let added = 0;
      while (index >= 0 && index < this.#points.length && added < 2) {
        const context = contextBucket(this.#points[index]);
        if (
          context &&
          (context.bucket === undefined || !addedBuckets.has(context.bucket)) &&
          !contextStarts.some((start) => start.eq(context.row.range[0]))
        ) {
          result.push(context.row);
          contextStarts.push(context.row.range[0]);
          added++;
        }
        index += step;
      }
    };
    addContext(first - 1, -1);
    addContext(last, 1);

    const intervals = this.#intervals.query(start, end);
    const intervalStart = lowerBound(this.#intervalEntries, start);
    const intervalEnd = lowerBound(this.#intervalEntries, end, intervalStart);
    let contextCount = 0;
    for (let index = intervalStart - 1; index >= 0 && contextCount < 2; index--) {
      const entry = this.#intervalEntries[index];
      if (intervals.has(entry)) continue;
      intervals.add(entry);
      contextCount++;
    }
    contextCount = 0;
    for (let index = intervalEnd; index < this.#intervalEntries.length && contextCount < 2; index++) {
      const entry = this.#intervalEntries[index];
      if (intervals.has(entry)) continue;
      intervals.add(entry);
      contextCount++;
    }
    for (const interval of intervals) result.push(interval.row);
    return result.toSorted((a, b) => a.range[0].cmp(b.range[0]));
  }
}
