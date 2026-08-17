import { Decimal } from '#src/core/decimal';

type IntervalItem<T> = {
  start: Decimal;
  end: Decimal;
  bound: IntervalBound;
  data: T;
};

type IntervalQuery = Omit<IntervalItem<unknown>, 'data' | 'start' | 'end'> & {
  start?: Decimal;
  end?: Decimal;
};

type NodeColor = boolean;

export type IntervalBound = '[]' | '[)' | '(]' | '()';
export type IntervalEntry<T> = IntervalItem<T>;

class IntervalNode<T> {
  item: IntervalItem<T>;
  maxEnd: Decimal;
  maxEndItem: IntervalItem<T>;
  left: IntervalNode<T> | null = null;
  right: IntervalNode<T> | null = null;
  parent: IntervalNode<T> | null = null;
  color: NodeColor = false;

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
    const node = new IntervalNode<T>({ start, end, bound, data });
    node.color = true;

    let parent: IntervalNode<T> | null = null;
    let cur = this.root;
    while (cur) {
      parent = cur;
      if (start.lt(cur.item.start)) {
        cur = cur.left;
      } else {
        cur = cur.right;
      }
    }

    node.parent = parent;
    if (!parent) {
      this.root = node;
    } else if (start.lt(parent.item.start)) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this.refreshUp(node.parent);
    this.fixInsert(node);
    return this;
  }

  bulkInsert(items: T[], accessor: (item: T, idx: number, items: T[]) => [Decimal, Decimal, IntervalBound?]): this {
    if (items.length === 0) {
      this.root = null;
      return this;
    }
    const intervals = items.map((item, idx, items) => {
      const [start, end, bound = '[)'] = accessor(item, idx, items);
      return { start, end, bound, data: item };
    });
    intervals.sort((a, b) => {
      const startCmp = a.start.cmp(b.start);
      if (startCmp !== 0) return startCmp;
      return a.end.cmp(b.end);
    });

    const [root, maxDepth] = this.buildBalanced(intervals, 0, intervals.length - 1, 0, null);
    this.root = root;
    if (this.root) {
      this.paintDeepestRed(this.root, 0, maxDepth);
      this.root.color = false;
    }
    return this;
  }

  query(start: Decimal | undefined, end: Decimal | undefined, bound: IntervalBound = '[)') {
    const result: Set<T> = new Set();
    this.collectOverlaps(this.root, { start, end, bound }, result);
    return result;
  }

  queryInto(out: Set<T>, start: Decimal | undefined, end: Decimal | undefined, bound: IntervalBound = '[)') {
    this.collectOverlaps(this.root, { start, end, bound }, out);
    return out;
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

  private buildBalanced(
    items: IntervalItem<T>[],
    lo: number,
    hi: number,
    depth: number,
    parent: IntervalNode<T> | null,
  ): [IntervalNode<T> | null, number] {
    if (lo > hi) return [null, depth - 1];
    const mid = (lo + hi) >> 1;
    const node = new IntervalNode<T>(items[mid]);
    node.parent = parent;

    const [left, leftDepth] = this.buildBalanced(items, lo, mid - 1, depth + 1, node);
    const [right, rightDepth] = this.buildBalanced(items, mid + 1, hi, depth + 1, node);
    node.left = left;
    node.right = right;
    node.recalc();

    return [node, Math.max(depth, leftDepth, rightDepth)];
  }

  private paintDeepestRed(node: IntervalNode<T>, depth: number, maxDepth: number): void {
    if (depth === maxDepth && depth > 0) {
      node.color = true;
    } else {
      node.color = false;
    }
    if (node.left) this.paintDeepestRed(node.left, depth + 1, maxDepth);
    if (node.right) this.paintDeepestRed(node.right, depth + 1, maxDepth);
  }

  private refreshUp(node: IntervalNode<T> | null): void {
    let cur = node;
    while (cur) {
      cur.recalc();
      cur = cur.parent;
    }
  }

  private leftRotate(x: IntervalNode<T>): void {
    const y = x.right;
    if (!y) return;

    x.right = y.left;
    if (y.left) y.left.parent = x;

    y.parent = x.parent;
    if (!x.parent) {
      this.root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }

    y.left = x;
    x.parent = y;

    x.recalc();
    y.recalc();
    this.refreshUp(y.parent);
  }

  private rightRotate(y: IntervalNode<T>): void {
    const x = y.left;
    if (!x) return;

    y.left = x.right;
    if (x.right) x.right.parent = y;

    x.parent = y.parent;
    if (!y.parent) {
      this.root = x;
    } else if (y === y.parent.left) {
      y.parent.left = x;
    } else {
      y.parent.right = x;
    }

    x.right = y;
    y.parent = x;

    y.recalc();
    x.recalc();
    this.refreshUp(x.parent);
  }

  private fixInsert(node: IntervalNode<T>): void {
    let z = node;
    while (z.parent && z.parent.color) {
      const gp = z.parent.parent;
      if (!gp) break;

      if (z.parent === gp.left) {
        const y = gp.right;
        if (y && y.color) {
          z.parent.color = false;
          y.color = false;
          gp.color = true;
          z = gp;
        } else {
          if (z === z.parent.right) {
            z = z.parent;
            this.leftRotate(z);
          }
          if (z.parent) z.parent.color = false;
          gp.color = true;
          this.rightRotate(gp);
        }
      } else {
        const y = gp.left;
        if (y && y.color) {
          z.parent.color = false;
          y.color = false;
          gp.color = true;
          z = gp;
        } else {
          if (z === z.parent.left) {
            z = z.parent;
            this.rightRotate(z);
          }
          if (z.parent) z.parent.color = false;
          gp.color = true;
          this.leftRotate(gp);
        }
      }
    }
    if (this.root) this.root.color = false;
  }
}

function overlaps(a: IntervalQuery, b: IntervalQuery): boolean {
  return !isBefore(a, b) && !isBefore(b, a);
}

function isBefore(a: IntervalQuery, b: IntervalQuery): boolean {
  if (!a.end || !b.start) return false;
  const cmp = a.end.cmp(b.start);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  return !(a.bound[1] === ']' && b.bound[0] === '[');
}

function canOverlapRightOf(maxEnd: Decimal, queryStart: Decimal | undefined, queryLeft: string): boolean {
  if (!queryStart) return true;
  const cmp = maxEnd.cmp(queryStart);
  return cmp > 0 || (cmp === 0 && queryLeft === '[');
}

function canOverlapLeftOf(nodeStart: Decimal, queryEnd: Decimal | undefined, queryRight: string): boolean {
  if (!queryEnd) return true;
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
