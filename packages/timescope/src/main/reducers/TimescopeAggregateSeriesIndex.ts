import type { TimescopeChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeDataRow } from '#src/main/TimescopeData';

type Entry = { row: TimescopeDataRow; ordinal: number; leaf?: LeafNode };

type MutableValueAggregate = {
  count: number;
  sum: Decimal;
  min: Decimal | null;
  max: Decimal | null;
  first: Decimal | null;
  last: Decimal | null;
};

export type TimescopeValueAggregate = Readonly<{
  avg: Decimal | null;
  min: Decimal | null;
  max: Decimal | null;
  first: Decimal | null;
  last: Decimal | null;
}>;
export type TimescopePointAggregate = Readonly<Record<string, TimescopeValueAggregate>>;

export type TimescopeAggregateBucket = {
  range: TimescopeRange<Decimal>;
  aggregate: TimescopePointAggregate;
};

type NodeBase = {
  id: number;
  parent?: BranchNode;
  first: Entry;
  last: Entry;
  maxEnd: Decimal;
  pointFirst?: Entry;
  pointLast?: Entry;
  intervalFirst?: Entry;
  intervalLast?: Entry;
  pointCount: number;
  aggregate: Map<string, MutableValueAggregate>;
};

type LeafNode = NodeBase & {
  leaf: true;
  entries: Entry[];
  previous?: LeafNode;
  next?: LeafNode;
};

type BranchNode = NodeBase & { leaf: false; children: TreeNode[] };
type TreeNode = LeafNode | BranchNode;

type BucketAccumulator = {
  range: TimescopeRange<Decimal>;
  aggregate: Map<string, MutableValueAggregate>;
  count: number;
  firstRow: TimescopeDataRow;
};
type BucketKey = number | `before:${number}` | `after:${number}`;

const leafCapacity = 64;
const branchCapacity = 32;
const leafMinimum = leafCapacity >> 1;
const branchMinimum = branchCapacity >> 1;
const outputSuffixes = ['avg', 'min', 'max', 'first', 'last'] as const;

function isPoint(entry: Entry) {
  return entry.row.range[0].eq(entry.row.range[1]);
}

function compareEntries(a: Entry, b: Entry) {
  return a.row.range[0].cmp(b.row.range[0]) || a.ordinal - b.ordinal;
}

function lowerBound(entries: readonly Entry[], target: Entry) {
  let left = 0;
  let right = entries.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (compareEntries(entries[middle], target) < 0) left = middle + 1;
    else right = middle;
  }
  return left;
}

function lowerBoundTime(entries: readonly Entry[], time: Decimal) {
  let left = 0;
  let right = entries.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (entries[middle].row.range[0].lt(time)) left = middle + 1;
    else right = middle;
  }
  return left;
}

function balancedGroups<T>(values: readonly T[], capacity: number) {
  const count = Math.ceil(values.length / capacity);
  const size = Math.floor(values.length / count);
  let extra = values.length % count;
  const groups: T[][] = [];
  let offset = 0;
  for (let index = 0; index < count; index++) {
    const length = size + (extra-- > 0 ? 1 : 0);
    groups.push(values.slice(offset, offset + length));
    offset += length;
  }
  return groups;
}

function addValue(target: Map<string, MutableValueAggregate>, key: string, value: Decimal) {
  const current = target.get(key);
  if (!current || current.count === 0) {
    target.set(key, { count: 1, sum: value, min: value, max: value, first: value, last: value });
    return;
  }
  current.count++;
  current.sum = current.sum.add(value);
  if (value.lt(current.min!)) current.min = value;
  if (value.gt(current.max!)) current.max = value;
  current.last = value;
}

function addEntry(target: Map<string, MutableValueAggregate>, entry: Entry) {
  for (const [key, value] of Object.entries(entry.row.values)) {
    if (value !== null) addValue(target, key, value);
    else if (!target.has(key))
      target.set(key, { count: 0, sum: Decimal(0), min: null, max: null, first: null, last: null });
  }
}

function mergeAggregate(
  target: Map<string, MutableValueAggregate>,
  source: ReadonlyMap<string, MutableValueAggregate>,
) {
  for (const [key, value] of source) {
    const current = target.get(key);
    if (!current) {
      target.set(key, { ...value });
      continue;
    }
    if (value.count === 0) continue;
    if (current.count === 0) {
      target.set(key, { ...value });
      continue;
    }
    current.count += value.count;
    current.sum = current.sum.add(value.sum);
    if (value.min!.lt(current.min!)) current.min = value.min;
    if (value.max!.gt(current.max!)) current.max = value.max;
    current.last = value.last;
  }
}

function publicAggregate(source: ReadonlyMap<string, MutableValueAggregate>): TimescopePointAggregate {
  return Object.fromEntries(
    [...source].map(([key, value]) => [
      key,
      {
        avg: value.count ? value.sum.div(value.count) : null,
        min: value.min,
        max: value.max,
        first: value.first,
        last: value.last,
      },
    ]),
  );
}

function intersects(row: TimescopeDataRow, start: Decimal, end: Decimal) {
  if (start.eq(end)) return false;
  const [rowStart, rowEnd, bound] = row.range;
  if (rowStart.eq(rowEnd)) return rowStart.ge(start) && rowStart.lt(end);
  return rowStart.lt(end) && (rowEnd.gt(start) || (rowEnd.eq(start) && bound[1] === ']'));
}

/** Incrementally maintained min/max/average index. Percentiles remain in TimescopeStaticSeriesIndex. */
export class TimescopeAggregateSeriesIndex {
  #root?: TreeNode;
  #firstLeaf?: LeafNode;
  #nextOrdinal = 0;
  #nextNodeId = 1;
  #size = 0;
  #bucketStats = { mergedNodes: 0, scannedEntries: 0 };

  constructor(rows: readonly TimescopeDataRow[] = []) {
    if (rows.length) this.#bulkLoad(rows);
  }

  get size() {
    return this.#size;
  }

  append(rows: TimescopeDataRow | readonly TimescopeDataRow[]) {
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      this.#insert({ row, ordinal: this.#nextOrdinal++ });
    }
    return this;
  }

  replaceRange(range: TimescopeRange<Decimal>, replacements: readonly TimescopeDataRow[]) {
    const [start, end] = range;
    if (end.lt(start)) throw new RangeError('Replacement range end must not precede its start');
    const removed = new Set<Entry>();
    this.#collectOverlaps(this.#root, start, end, removed);
    if (removed.size > this.#size / 4) {
      const retained = this.#allEntries().filter((entry) => !removed.has(entry));
      retained.push(...replacements.map((row) => ({ row, ordinal: this.#nextOrdinal++ })));
      this.#loadEntries(retained);
      return this;
    }
    for (const entry of removed) this.#delete(entry);
    this.append(replacements);
    return this;
  }

  raw(range?: TimescopeRange<Decimal>, context = true) {
    if (!range) return this.#allEntries().map((entry) => entry.row);
    const [start, end] = range;
    if (end.lt(start)) throw new RangeError('Query range end must not precede its start');
    const selected = new Set<Entry>();
    this.#collectOverlaps(this.#root, start, end, selected);
    if (context) {
      let count = 0;
      for (const entry of this.#entriesBefore(start)) {
        if (selected.has(entry)) continue;
        selected.add(entry);
        if (++count === 2) break;
      }
      count = 0;
      for (const entry of this.#entriesAtOrAfter(end)) {
        if (selected.has(entry)) continue;
        selected.add(entry);
        if (++count === 2) break;
      }
    }
    return [...selected].toSorted(compareEntries).map((entry) => entry.row);
  }

  aggregate(range: TimescopeRange<Decimal>) {
    const [start, end] = range;
    if (end.lt(start)) throw new RangeError('Aggregate range end must not precede its start');
    const aggregate = new Map<string, MutableValueAggregate>();
    this.#collectAggregate(this.#root, start, end, aggregate);
    return publicAggregate(aggregate);
  }

  buckets(range: TimescopeRange<Decimal>, resolution: Decimal, context = true): TimescopeAggregateBucket[] {
    const accumulators = this.#bucketAccumulators(range, resolution);
    if (context) this.#addBucketContext(accumulators, range, resolution);
    return [...accumulators.values()]
      .toSorted((a, b) => a.range[0].cmp(b.range[0]))
      .map(({ range, aggregate }) => ({ range, aggregate: publicAggregate(aggregate) }));
  }

  query(chunk: TimescopeChunk) {
    const [start, end] = chunk.range;
    if (!start || !end) throw new RangeError('Chunk range must be finite');
    if (chunk.resolution.le(0)) throw new RangeError('Chunk resolution must be positive');

    const accumulators = this.#bucketAccumulators([start, end], chunk.resolution);
    this.#addBucketContext(accumulators, [start, end], chunk.resolution);
    const rows = [...accumulators.values()].map((bucket) => this.#bucketRow(bucket));
    const intervals = new Set<Entry>();
    this.#collectIntervals(this.#root, start, end, intervals);
    let contextCount = 0;
    for (const entry of this.#entriesBefore(start, false, true)) {
      if (intervals.has(entry)) continue;
      intervals.add(entry);
      if (++contextCount === 2) break;
    }
    contextCount = 0;
    for (const entry of this.#entriesAtOrAfter(end, false, true)) {
      if (intervals.has(entry)) continue;
      intervals.add(entry);
      if (++contextCount === 2) break;
    }
    rows.push(...[...intervals].map((entry) => entry.row));
    return rows.toSorted((a, b) => a.range[0].cmp(b.range[0]));
  }

  queryRaw(chunk: TimescopeChunk) {
    const [start, end] = chunk.range;
    if (!start || !end) throw new RangeError('Chunk range must be finite');
    if (chunk.resolution.le(0)) throw new RangeError('Chunk resolution must be positive');
    return this.raw([start, end]);
  }

  diagnostics() {
    const nodes: { id: number; leaf: boolean; size: number; parent?: number; first: Decimal; last: Decimal }[] = [];
    const visit = (node: TreeNode) => {
      nodes.push({
        id: node.id,
        leaf: node.leaf,
        size: node.leaf ? node.entries.length : node.children.length,
        parent: node.parent?.id,
        first: node.first.row.range[0],
        last: node.last.row.range[0],
      });
      if (!node.leaf) for (const child of node.children) visit(child);
    };
    if (this.#root) visit(this.#root);
    return { root: this.#root?.id, nodes, buckets: { ...this.#bucketStats } };
  }

  #newLeaf(entries: Entry[]): LeafNode {
    const leaf = { id: this.#nextNodeId++, leaf: true as const, entries } as LeafNode;
    for (const entry of entries) entry.leaf = leaf;
    this.#recompute(leaf);
    return leaf;
  }

  #newBranch(children: TreeNode[]): BranchNode {
    const branch = { id: this.#nextNodeId++, leaf: false as const, children } as BranchNode;
    for (const child of children) child.parent = branch;
    this.#recompute(branch);
    return branch;
  }

  #bulkLoad(rows: readonly TimescopeDataRow[]) {
    const entries = rows.map((row) => ({ row, ordinal: this.#nextOrdinal++ })).toSorted(compareEntries);
    this.#loadEntries(entries);
  }

  #loadEntries(entries: Entry[]) {
    entries.sort(compareEntries);
    for (const entry of entries) entry.leaf = undefined;
    this.#root = undefined;
    this.#firstLeaf = undefined;
    this.#size = entries.length;
    if (!entries.length) return;
    let previous: LeafNode | undefined;
    let level: TreeNode[] = balancedGroups(entries, leafCapacity).map((group) => {
      const leaf = this.#newLeaf(group);
      if (previous) {
        previous.next = leaf;
        leaf.previous = previous;
      } else {
        this.#firstLeaf = leaf;
      }
      previous = leaf;
      return leaf;
    });
    while (level.length > 1) level = balancedGroups(level, branchCapacity).map((group) => this.#newBranch(group));
    this.#root = level[0];
  }

  #insert(entry: Entry) {
    this.#size++;
    if (!this.#root) {
      this.#root = this.#firstLeaf = this.#newLeaf([entry]);
      return;
    }

    const leaf = this.#findLeaf(entry);
    leaf.entries.splice(lowerBound(leaf.entries, entry), 0, entry);
    entry.leaf = leaf;
    this.#refresh(leaf);
    if (leaf.entries.length > leafCapacity) this.#splitLeaf(leaf);
  }

  #splitLeaf(leaf: LeafNode) {
    const right = this.#newLeaf(leaf.entries.splice(leaf.entries.length >> 1));
    right.next = leaf.next;
    if (right.next) right.next.previous = right;
    right.previous = leaf;
    leaf.next = right;
    this.#recompute(leaf);
    this.#insertSibling(leaf, right);
  }

  #insertSibling(left: TreeNode, right: TreeNode) {
    const parent = left.parent;
    if (!parent) {
      this.#root = this.#newBranch([left, right]);
      return;
    }
    const index = parent.children.indexOf(left);
    parent.children.splice(index + 1, 0, right);
    right.parent = parent;
    this.#refresh(parent);
    if (parent.children.length > branchCapacity) this.#splitBranch(parent);
  }

  #splitBranch(branch: BranchNode) {
    const right = this.#newBranch(branch.children.splice(branch.children.length >> 1));
    this.#recompute(branch);
    this.#insertSibling(branch, right);
  }

  #delete(entry: Entry) {
    const leaf = entry.leaf;
    if (!leaf) return;
    const index = leaf.entries.indexOf(entry);
    if (index < 0) return;
    leaf.entries.splice(index, 1);
    entry.leaf = undefined;
    this.#size--;

    if (leaf === this.#root) {
      if (!leaf.entries.length) this.#root = this.#firstLeaf = undefined;
      else this.#recompute(leaf);
      return;
    }
    this.#refresh(leaf);
    if (leaf.entries.length < leafMinimum) this.#rebalanceLeaf(leaf);
  }

  #rebalanceLeaf(leaf: LeafNode) {
    const parent = leaf.parent!;
    const index = parent.children.indexOf(leaf);
    const left = parent.children[index - 1] as LeafNode | undefined;
    const right = parent.children[index + 1] as LeafNode | undefined;
    if (left && left.entries.length > leafMinimum) {
      const entry = left.entries.pop()!;
      leaf.entries.unshift(entry);
      entry.leaf = leaf;
      this.#refresh(left);
      this.#refresh(leaf);
      return;
    }
    if (right && right.entries.length > leafMinimum) {
      const entry = right.entries.shift()!;
      leaf.entries.push(entry);
      entry.leaf = leaf;
      this.#refresh(right);
      this.#refresh(leaf);
      return;
    }
    if (left) this.#mergeLeaves(left, leaf);
    else if (right) this.#mergeLeaves(leaf, right);
  }

  #mergeLeaves(left: LeafNode, right: LeafNode) {
    left.entries.push(...right.entries);
    for (const entry of right.entries) entry.leaf = left;
    left.next = right.next;
    if (right.next) right.next.previous = left;
    this.#removeChild(right.parent!, right);
    this.#refresh(left);
  }

  #removeChild(parent: BranchNode, child: TreeNode) {
    parent.children.splice(parent.children.indexOf(child), 1);
    child.parent = undefined;
    if (parent === this.#root && parent.children.length === 1) {
      this.#root = parent.children[0];
      this.#root.parent = undefined;
      return;
    }
    this.#refresh(parent);
    if (parent !== this.#root && parent.children.length < branchMinimum) this.#rebalanceBranch(parent);
  }

  #rebalanceBranch(branch: BranchNode) {
    const parent = branch.parent!;
    const index = parent.children.indexOf(branch);
    const left = parent.children[index - 1] as BranchNode | undefined;
    const right = parent.children[index + 1] as BranchNode | undefined;
    if (left && left.children.length > branchMinimum) {
      const child = left.children.pop()!;
      branch.children.unshift(child);
      child.parent = branch;
      this.#refresh(left);
      this.#refresh(branch);
      return;
    }
    if (right && right.children.length > branchMinimum) {
      const child = right.children.shift()!;
      branch.children.push(child);
      child.parent = branch;
      this.#refresh(right);
      this.#refresh(branch);
      return;
    }
    if (left) this.#mergeBranches(left, branch);
    else if (right) this.#mergeBranches(branch, right);
  }

  #mergeBranches(left: BranchNode, right: BranchNode) {
    left.children.push(...right.children);
    for (const child of right.children) child.parent = left;
    this.#removeChild(right.parent!, right);
    this.#refresh(left);
  }

  #findLeaf(entry: Entry) {
    let node = this.#root!;
    while (!node.leaf) {
      node = node.children.find((child) => compareEntries(entry, child.last) <= 0) ?? node.children.at(-1)!;
    }
    return node;
  }

  #findLeafForTime(time: Decimal) {
    let node = this.#root;
    while (node && !node.leaf) {
      node = node.children.find((child) => time.le(child.last.row.range[0])) ?? node.children.at(-1)!;
    }
    return node;
  }

  *#entriesBefore(time: Decimal, pointsOnly = false, intervalsOnly = false) {
    let leaf = this.#findLeafForTime(time);
    if (!leaf) return;
    let index = lowerBoundTime(leaf.entries, time) - 1;
    while (leaf) {
      for (; index >= 0; index--) {
        const point = isPoint(leaf.entries[index]);
        if ((!pointsOnly || point) && (!intervalsOnly || !point)) yield leaf.entries[index];
      }
      leaf = leaf.previous;
      index = leaf ? leaf.entries.length - 1 : -1;
    }
  }

  *#entriesAtOrAfter(time: Decimal, pointsOnly = false, intervalsOnly = false) {
    let leaf = this.#findLeafForTime(time);
    if (!leaf) return;
    let index = lowerBoundTime(leaf.entries, time);
    while (leaf) {
      for (; index < leaf.entries.length; index++) {
        const point = isPoint(leaf.entries[index]);
        if ((!pointsOnly || point) && (!intervalsOnly || !point)) yield leaf.entries[index];
      }
      leaf = leaf.next;
      index = 0;
    }
  }

  #allEntries() {
    const entries: Entry[] = [];
    for (let leaf = this.#firstLeaf; leaf; leaf = leaf.next) entries.push(...leaf.entries);
    return entries;
  }

  #refresh(node: TreeNode) {
    let current: TreeNode | undefined = node;
    while (current) {
      this.#recompute(current);
      current = current.parent;
    }
  }

  #recompute(node: TreeNode) {
    node.aggregate = new Map();
    node.pointFirst = undefined;
    node.pointLast = undefined;
    node.intervalFirst = undefined;
    node.intervalLast = undefined;
    node.pointCount = 0;

    if (node.leaf) {
      if (!node.entries.length) return;
      node.first = node.entries[0];
      node.last = node.entries.at(-1)!;
      node.maxEnd = node.first.row.range[1];
      for (const entry of node.entries) {
        if (entry.row.range[1].gt(node.maxEnd)) node.maxEnd = entry.row.range[1];
        if (isPoint(entry)) {
          node.pointFirst ??= entry;
          node.pointLast = entry;
          node.pointCount++;
          addEntry(node.aggregate, entry);
        } else {
          node.intervalFirst ??= entry;
          node.intervalLast = entry;
        }
      }
      return;
    }
    if (!node.children.length) return;
    node.first = node.children[0].first;
    node.last = node.children.at(-1)!.last;
    node.maxEnd = node.children[0].maxEnd;
    for (const child of node.children) {
      if (child.maxEnd.gt(node.maxEnd)) node.maxEnd = child.maxEnd;
      if (child.pointFirst) node.pointFirst ??= child.pointFirst;
      if (child.pointLast) node.pointLast = child.pointLast;
      if (child.intervalFirst) node.intervalFirst ??= child.intervalFirst;
      if (child.intervalLast) node.intervalLast = child.intervalLast;
      node.pointCount += child.pointCount;
      mergeAggregate(node.aggregate, child.aggregate);
    }
  }

  #collectOverlaps(node: TreeNode | undefined, start: Decimal, end: Decimal, result: Set<Entry>) {
    if (!node || node.first.row.range[0].ge(end) || node.maxEnd.lt(start)) return;
    if (node.leaf) {
      for (const entry of node.entries) {
        if (entry.row.range[0].ge(end)) break;
        if (intersects(entry.row, start, end)) result.add(entry);
      }
      return;
    }
    for (const child of node.children) this.#collectOverlaps(child, start, end, result);
  }

  #collectIntervals(node: TreeNode | undefined, start: Decimal, end: Decimal, result: Set<Entry>) {
    if (!node?.intervalFirst || node.intervalFirst.row.range[0].ge(end) || node.maxEnd.lt(start)) return;
    if (node.leaf) {
      for (const entry of node.entries) {
        if (entry.row.range[0].ge(end)) break;
        if (!isPoint(entry) && intersects(entry.row, start, end)) result.add(entry);
      }
      return;
    }
    for (const child of node.children) this.#collectIntervals(child, start, end, result);
  }

  #collectAggregate(
    node: TreeNode | undefined,
    start: Decimal,
    end: Decimal,
    result: Map<string, MutableValueAggregate>,
  ) {
    if (!node?.pointFirst || node.pointFirst.row.range[0].ge(end) || node.pointLast!.row.range[0].lt(start)) return;
    if (node.pointFirst.row.range[0].ge(start) && node.pointLast!.row.range[0].lt(end)) {
      mergeAggregate(result, node.aggregate);
      return;
    }
    if (node.leaf) {
      for (const entry of node.entries) {
        if (entry.row.range[0].ge(end)) break;
        if (isPoint(entry) && entry.row.range[0].ge(start)) addEntry(result, entry);
      }
      return;
    }
    for (const child of node.children) this.#collectAggregate(child, start, end, result);
  }

  #bucketAccumulators(range: TimescopeRange<Decimal>, resolution: Decimal) {
    const [start, end] = range;
    if (end.lt(start)) throw new RangeError('Bucket range end must not precede its start');
    if (resolution.le(0)) throw new RangeError('Bucket resolution must be positive');
    this.#bucketStats = { mergedNodes: 0, scannedEntries: 0 };
    const buckets = new Map<BucketKey, BucketAccumulator>();
    this.#collectBuckets(this.#root, start, end, start, resolution, buckets);
    return buckets;
  }

  #collectBuckets(
    node: TreeNode | undefined,
    start: Decimal,
    end: Decimal,
    origin: Decimal,
    resolution: Decimal,
    buckets: Map<BucketKey, BucketAccumulator>,
  ) {
    if (!node?.pointFirst || node.pointFirst.row.range[0].ge(end) || node.pointLast!.row.range[0].lt(start)) return;
    const firstTime = node.pointFirst.row.range[0];
    const lastTime = node.pointLast!.row.range[0];
    if (firstTime.ge(start) && lastTime.lt(end)) {
      const firstBucket = this.#bucketNumber(firstTime, origin, resolution);
      const lastBucket = this.#bucketNumber(lastTime, origin, resolution);
      if (firstBucket === lastBucket) {
        this.#bucketStats.mergedNodes++;
        this.#mergeBucket(
          buckets,
          firstBucket,
          origin,
          resolution,
          node.aggregate,
          node.pointCount,
          node.pointFirst.row,
        );
        return;
      }
    }
    if (node.leaf) {
      for (const entry of node.entries) {
        this.#bucketStats.scannedEntries++;
        const time = entry.row.range[0];
        if (time.ge(end)) break;
        if (!isPoint(entry) || time.lt(start)) continue;
        this.#mergeBucket(
          buckets,
          this.#bucketNumber(time, origin, resolution),
          origin,
          resolution,
          undefined,
          1,
          entry.row,
          entry,
        );
      }
      return;
    }
    for (const child of node.children) this.#collectBuckets(child, start, end, origin, resolution, buckets);
  }

  #mergeBucket(
    buckets: Map<BucketKey, BucketAccumulator>,
    bucket: number,
    origin: Decimal,
    resolution: Decimal,
    aggregate: ReadonlyMap<string, MutableValueAggregate> | undefined,
    count: number,
    firstRow: TimescopeDataRow,
    entry?: Entry,
  ) {
    let target = buckets.get(bucket);
    if (!target) {
      const bucketStart = origin.add(resolution.mul(bucket));
      target = { range: [bucketStart, bucketStart.add(resolution)], aggregate: new Map(), count: 0, firstRow };
      buckets.set(bucket, target);
    }
    target.count += count;
    if (aggregate) mergeAggregate(target.aggregate, aggregate);
    else if (entry) addEntry(target.aggregate, entry);
  }

  #addBucketContext(
    buckets: Map<BucketKey, BucketAccumulator>,
    [start, end]: TimescopeRange<Decimal>,
    resolution: Decimal,
  ) {
    const add = (entry: Entry, distantKey: Exclude<BucketKey, number>) => {
      const bucketOffset = entry.row.range[0].sub(start).div(resolution).floor();
      const numericBucket = bucketOffset.number();
      const bucket = Number.isSafeInteger(numericBucket) ? numericBucket : undefined;
      const bucketStart = start.add(resolution.mul(bucketOffset));
      const bucketEnd = bucketStart.add(resolution);
      if (bucket !== undefined) {
        if (buckets.has(bucket)) return { added: false, bucketStart, bucketEnd };
        this.#collectBuckets(this.#root, bucketStart, bucketEnd, start, resolution, buckets);
        return { added: true, bucketStart, bucketEnd };
      }

      if ([...buckets.values()].some((bucket) => bucket.range[0].eq(bucketStart))) {
        return { added: false, bucketStart, bucketEnd };
      }
      const context = new Map<BucketKey, BucketAccumulator>();
      this.#collectBuckets(this.#root, bucketStart, bucketEnd, bucketStart, resolution, context);
      const accumulator = context.get(0);
      if (!accumulator) return { added: false, bucketStart, bucketEnd };
      buckets.set(distantKey, accumulator);
      return { added: true, bucketStart, bucketEnd };
    };

    let before = 0;
    let cursor = start;
    while (before < 2) {
      const entry = this.#entriesBefore(cursor, true).next().value;
      if (!entry) break;
      const result = add(entry, `before:${before}`);
      cursor = result.bucketStart;
      if (result.added) before++;
    }

    let after = 0;
    cursor = end;
    while (after < 2) {
      const entry = this.#entriesAtOrAfter(cursor, true).next().value;
      if (!entry) break;
      const result = add(entry, `after:${after}`);
      cursor = result.bucketEnd;
      if (result.added) after++;
    }
  }

  #bucketNumber(time: Decimal, origin: Decimal, resolution: Decimal, required?: true): number;
  #bucketNumber(time: Decimal, origin: Decimal, resolution: Decimal, required: false): number | undefined;
  #bucketNumber(time: Decimal, origin: Decimal, resolution: Decimal, required = true) {
    const bucket = time.sub(origin).div(resolution).floor().number();
    if (Number.isSafeInteger(bucket)) return bucket;
    if (required) throw new RangeError('Bucket coordinate exceeds the safe integer range');
  }

  #bucketRow(bucket: BucketAccumulator): TimescopeDataRow {
    const aggregate = publicAggregate(bucket.aggregate);
    const values: Record<string, Decimal | null> = {};
    for (const [key, value] of Object.entries(aggregate)) {
      values[key] = value.avg;
      for (const suffix of outputSuffixes) values[`${key}#${suffix}`] = value[suffix];
    }
    if (bucket.count === 1) return { ...bucket.firstRow, values };
    const midpoint = bucket.range[0].add(bucket.range[1]).div(2);
    return {
      times: Object.fromEntries(Object.keys(bucket.firstRow.times).map((key) => [key, midpoint])),
      values,
      data: undefined,
      range: [bucket.range[0], bucket.range[1], '[)'],
    };
  }
}
