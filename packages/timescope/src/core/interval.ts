import { Decimal } from '#src/core/decimal';

type IntervalItem<T> = {
  start: Decimal;
  end: Decimal;
  bound: IntervalBound;
  data: T;
};

type IntervalQuery = Omit<IntervalItem<unknown>, 'data'>;

export type IntervalBound = '[]' | '[)' | '(]' | '()';
export type IntervalEntry<T> = IntervalItem<T>;

class IntervalNode<T> {
  item: IntervalItem<T>;
  maxEnd: Decimal;
  maxEndItem: IntervalItem<T>;
  left: IntervalNode<T> | null = null;
  right: IntervalNode<T> | null = null;

  constructor(item: IntervalItem<T>) {
    this.item = item;
    this.maxEnd = item.end;
    this.maxEndItem = item;
  }

  recalc(): void {
    let best = this.item;
    const leftItem = this.left?.maxEndItem;
    const rightItem = this.right?.maxEndItem;
    if (leftItem) best = pickMaxEnd(best, leftItem);
    if (rightItem) best = pickMaxEnd(best, rightItem);
    this.maxEndItem = best;
    this.maxEnd = best.end;
  }
}

export class IntervalTree<T> {
  private root: IntervalNode<T> | null = null;

  insert(data: T, start: Decimal, end: Decimal, bound: IntervalBound = '[)'): this {
    this.root = this.insertNode(this.root, { start, end, bound, data });
    return this;
  }

  bulkInsert(items: T[], accessor: (item: T) => [Decimal, Decimal, IntervalBound?]): this {
    if (items.length === 0) {
      this.root = null;
      return this;
    }
    const intervals = items.map((item) => {
      const [start, end, bound = '[)'] = accessor(item);
      return { start, end, bound, data: item };
    });
    intervals.sort((a, b) => {
      const startCmp = a.start.cmp(b.start);
      if (startCmp !== 0) return startCmp;
      return a.end.cmp(b.end);
    });
    this.root = this.buildBalanced(intervals, 0, intervals.length - 1);
    return this;
  }

  private insertNode(node: IntervalNode<T> | null, item: IntervalItem<T>): IntervalNode<T> {
    if (!node) return new IntervalNode<T>(item);

    if (item.start.lt(node.item.start)) {
      node.left = this.insertNode(node.left, item);
    } else {
      node.right = this.insertNode(node.right, item);
    }

    node.recalc();
    return node;
  }

  private buildBalanced(items: IntervalItem<T>[], lo: number, hi: number): IntervalNode<T> | null {
    if (lo > hi) return null;
    const mid = (lo + hi) >> 1;
    const node = new IntervalNode<T>(items[mid]);
    node.left = this.buildBalanced(items, lo, mid - 1);
    node.right = this.buildBalanced(items, mid + 1, hi);
    node.recalc();
    return node;
  }

  query(start: Decimal, end: Decimal, bound: IntervalBound = '[)'): SetIterator<T> {
    const result: Set<T> = new Set();
    this.collectOverlaps(this.root, { start, end, bound }, result);
    return result.values();
  }

  queryInto(out: Set<T>, start: Decimal, end: Decimal, bound: IntervalBound = '[)') {
    this.collectOverlaps(this.root, { start, end, bound }, out);
  }

  findMaxEndBefore(t: Decimal): IntervalEntry<T> | null {
    let node = this.root;
    let best: IntervalItem<T> | null = null;
    while (node) {
      if (node.item.start.le(t)) {
        best = pickMaxEndNullable(best, node.item);
        if (node.left) {
          best = pickMaxEndNullable(best, node.left.maxEndItem);
        }
        node = node.right;
      } else {
        node = node.left;
      }
    }
    return best;
  }

  findMinStartAfter(t: Decimal): IntervalEntry<T> | null {
    let node = this.root;
    let best: IntervalItem<T> | null = null;
    while (node) {
      if (node.item.start.ge(t)) {
        best = node.item;
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return best;
  }

  private collectOverlaps(node: IntervalNode<T> | null, query: IntervalQuery, out: Set<T>): void {
    if (!node) return;

    if (node.left && canOverlapRightOf(node.left.maxEnd, query.start, query.bound[0])) {
      this.collectOverlaps(node.left, query, out);
    }

    if (overlaps(node.item, query)) {
      if (!out.has(node.item.data)) out.add(node.item.data);
    }

    if (node.right && canOverlapLeftOf(node.item.start, query.end, query.bound[1])) {
      this.collectOverlaps(node.right, query, out);
    }
  }
}

function overlaps(a: IntervalQuery, b: IntervalQuery): boolean {
  return !isBefore(a, b) && !isBefore(b, a);
}

function isBefore(a: IntervalQuery, b: IntervalQuery): boolean {
  const cmp = a.end.cmp(b.start);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  return !(a.bound[1] === ']' && b.bound[0] === '[');
}

function canOverlapRightOf(maxEnd: Decimal, queryStart: Decimal, queryLeft: string): boolean {
  const cmp = maxEnd.cmp(queryStart);
  return cmp > 0 || (cmp === 0 && queryLeft === '[');
}

function canOverlapLeftOf(nodeStart: Decimal, queryEnd: Decimal, queryRight: string): boolean {
  const cmp = nodeStart.cmp(queryEnd);
  return cmp < 0 || (cmp === 0 && queryRight === ']');
}

function pickMaxEnd<T>(a: IntervalItem<T>, b: IntervalItem<T>): IntervalItem<T> {
  if (b.end.cmp(a.end) > 0) return b;
  return a;
}

function pickMaxEndNullable<T>(a: IntervalItem<T> | null, b: IntervalItem<T>): IntervalItem<T> {
  if (!a) return b;
  return pickMaxEnd(a, b);
}
