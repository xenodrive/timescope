import type { TimescopeChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import { addValue, mergeAggregate, publicAggregate, type MutableValueAggregate } from './TimescopeAggregateSeriesIndex';

type Aggregate = Map<string, MutableValueAggregate>;
function combine(left?: Aggregate, right?: Aggregate): Aggregate | undefined {
  if (!left) return right;
  if (!right) return left;
  const result: Aggregate = new Map();
  mergeAggregate(result, left);
  mergeAggregate(result, right);
  return result;
}

/** Append-only, time-ordered point index. Leaves correspond to individual rows. */
export class TimescopeSegmentSeriesIndex {
  #rows: TimescopeDataRow[] = [];
  #capacity = 1;
  #tree: (Aggregate | undefined)[] = new Array(2);

  constructor(rows: readonly TimescopeDataRow[] = []) {
    this.append(rows);
  }

  get size() {
    return this.#rows.length;
  }

  #lowerBound(time: Decimal, from = 0) {
    let left = from;
    let right = this.#rows.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (this.#rows[middle].range[0].lt(time)) left = middle + 1;
      else right = middle;
    }
    return left;
  }

  previousTime(time: Decimal) {
    return this.#rows[this.#lowerBound(time) - 1]?.range[0];
  }

  append(rows: readonly TimescopeDataRow[]) {
    let previous = this.#rows.at(-1)?.range[0];
    // Validate the complete batch before mutating the index.
    for (const row of rows) {
      const [start, end] = row.range;
      if (!start.eq(end)) throw new Error('Segment tree sources accept only point rows');
      if (previous && start.lt(previous)) throw new Error('Append-only rows must be in nondecreasing time order');
      previous = start;
    }
    if (!rows.length) return;
    const oldSize = this.#rows.length;
    const oldCapacity = this.#capacity;
    while (this.#capacity < oldSize + rows.length) this.#capacity *= 2;
    if (oldCapacity !== this.#capacity) {
      const next: (Aggregate | undefined)[] = new Array(this.#capacity * 2);
      for (let i = 0; i < oldSize; i++) next[this.#capacity + i] = this.#tree[oldCapacity + i];
      this.#tree = next;
    }
    for (const row of rows) {
      const aggregate: Aggregate = new Map();
      for (const [key, value] of Object.entries(row.values)) {
        if (value !== null) addValue(aggregate, key, value);
        else aggregate.set(key, { count: 0, sum: Decimal(0), min: null, max: null, first: null, last: null });
      }
      this.#tree[this.#capacity + this.#rows.length] = aggregate;
      this.#rows.push(row);
    }
    if (oldCapacity !== this.#capacity) {
      for (let i = this.#capacity - 1; i > 0; i--) this.#tree[i] = combine(this.#tree[i * 2], this.#tree[i * 2 + 1]);
    } else {
      // Recompute each affected ancestor once, including batched appends.
      let first = Math.floor((this.#capacity + oldSize) / 2);
      let last = Math.floor((this.#capacity + this.#rows.length - 1) / 2);
      while (first > 0) {
        for (let i = first; i <= last; i++) this.#tree[i] = combine(this.#tree[i * 2], this.#tree[i * 2 + 1]);
        first = Math.floor(first / 2);
        last = Math.floor(last / 2);
      }
    }
  }

  #aggregate(from: number, to: number) {
    let left: Aggregate | undefined;
    let right: Aggregate | undefined;
    from += this.#capacity;
    to += this.#capacity;
    while (from < to) {
      if (from % 2) left = combine(left, this.#tree[from++]);
      if (to % 2) right = combine(this.#tree[--to], right);
      from = Math.floor(from / 2);
      to = Math.floor(to / 2);
    }
    return publicAggregate(combine(left, right) ?? new Map());
  }

  query(chunk: Pick<TimescopeChunk, 'range' | 'resolution'>, raw = false): TimescopeDataRow[] {
    const [start, end] = chunk.range;
    if (!start || !end || end.lt(start)) throw new RangeError('Query range must be finite and ordered');
    if (chunk.resolution.le(0)) throw new RangeError('Chunk resolution must be positive');
    const first = this.#lowerBound(start);
    const last = this.#lowerBound(end);
    if (raw) return this.#rows.slice(Math.max(0, first - 2), Math.min(this.#rows.length, last + 2));
    const buckets = new Map<string, { start: Decimal; end: Decimal; from: number; to: number }>();
    const bounds = (time: Decimal) => {
      const offset = time.sub(start).divFloor(chunk.resolution);
      const bucketStart = start.add(offset.mul(chunk.resolution));
      return { key: offset.toString(), start: bucketStart, end: bucketStart.add(chunk.resolution) };
    };
    for (let from = first; from < last;) {
      const bucket = bounds(this.#rows[from].range[0]);
      const to = Math.min(last, this.#lowerBound(bucket.end, from + 1));
      buckets.set(bucket.key, { ...bucket, from, to });
      from = to;
    }
    // Two distinct context buckets on either side, including distant data.
    let before = first - 1;
    for (let count = 0; count < 2 && before >= 0; count++) {
      const bucket = bounds(this.#rows[before].range[0]);
      const from = this.#lowerBound(bucket.start);
      buckets.set(bucket.key, { ...bucket, from, to: before + 1 });
      before = from - 1;
    }
    let after = last;
    for (let count = 0; count < 2 && after < this.#rows.length;) {
      const bucket = bounds(this.#rows[after].range[0]);
      const to = this.#lowerBound(bucket.end, after + 1);
      if (!buckets.has(bucket.key)) {
        buckets.set(bucket.key, { ...bucket, from: this.#lowerBound(bucket.start), to });
        count++;
      }
      after = to;
    }
    return [...buckets.values()]
      .sort((a, b) => a.start.cmp(b.start))
      .map((bucket) => {
        const values: Record<string, Decimal | null> = {};
        for (const [key, value] of Object.entries(this.#aggregate(bucket.from, bucket.to))) {
          values[key] = value.avg;
          for (const suffix of ['avg', 'min', 'max', 'first', 'last'] as const)
            values[`${key}#${suffix}`] = value[suffix];
        }
        const row = this.#rows[bucket.from];
        if (bucket.to - bucket.from === 1) return { ...row, values };
        const midpoint = bucket.start.add(bucket.end).divExact(2);
        return {
          times: Object.fromEntries(Object.keys(row.times).map((key) => [key, midpoint])),
          values,
          data: undefined,
          range: [bucket.start, bucket.end, '[)'],
        };
      });
  }
}
