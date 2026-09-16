import { Decimal } from '#src/core/decimal';
import { RankBitVector } from '#src/core/RankBitVector';
import { WaveletMatrix } from '#src/core/WaveletMatrix';

export type TimescopeStaticValueAggregate = {
  first: Decimal | null;
  last: Decimal | null;
  min: Decimal | null;
  max: Decimal | null;
  p50: Decimal | null;
  p90: Decimal | null;
  p95: Decimal | null;
};

export class TimescopeStaticValueIndex {
  #validity?: RankBitVector;
  #dictionary: Decimal[] = [];
  #wavelet: WaveletMatrix;
  #length: number;

  constructor(values: readonly (Decimal | null | undefined)[]) {
    this.#length = values.length;
    const validValues = values.filter((value): value is Decimal => value != null);
    if (validValues.length !== values.length) {
      this.#validity = RankBitVector.fromPredicate(values.length, (index) => values[index] != null);
    }

    const order = Uint32Array.from({ length: validValues.length }, (_, index) => index);
    order.sort((a, b) => validValues[a].cmp(validValues[b]) || a - b);
    const ranks = new Uint32Array(validValues.length);
    let rank = -1;
    let previous: Decimal | undefined;
    for (const index of order) {
      const value = validValues[index];
      if (!previous || value.neq(previous)) {
        previous = value;
        this.#dictionary.push(value);
        rank++;
      }
      ranks[index] = rank;
    }
    this.#wavelet = new WaveletMatrix(ranks, this.#dictionary.length);
  }

  aggregate(left: number, right: number): TimescopeStaticValueAggregate {
    if (left < 0 || right > this.#length || left >= right) throw new RangeError('Invalid aggregate range');
    const valueLeft = this.#validity?.rank1(left) ?? left;
    const valueRight = this.#validity?.rank1(right) ?? right;
    const count = valueRight - valueLeft;
    if (!count) return { first: null, last: null, min: null, max: null, p50: null, p90: null, p95: null };

    const valueAt = (index: number) => this.#dictionary[this.#wavelet.access(index)];
    const kth = (index: number) => this.#dictionary[this.#wavelet.rangeKth(valueLeft, valueRight, index)];
    return {
      first: valueAt(valueLeft),
      last: valueAt(valueRight - 1),
      min: kth(0),
      max: kth(count - 1),
      p50: this.#percentile(valueLeft, valueRight, 1, 2),
      p90: this.#percentile(valueLeft, valueRight, 9, 10),
      p95: this.#percentile(valueLeft, valueRight, 19, 20),
    };
  }

  #percentile(left: number, right: number, numerator: number, denominator: number) {
    const count = right - left;
    const position = (count - 1) * numerator;
    const lowerIndex = Math.floor(position / denominator);
    const remainder = position % denominator;
    const lower = this.#dictionary[this.#wavelet.rangeKth(left, right, lowerIndex)];
    if (!remainder) return lower;
    const upper = this.#dictionary[this.#wavelet.rangeKth(left, right, lowerIndex + 1)];
    return lower.add(upper.sub(lower).mul(remainder).divExact(denominator));
  }

  get byteLength() {
    return (this.#validity?.byteLength ?? 0) + this.#wavelet.byteLength;
  }
}
