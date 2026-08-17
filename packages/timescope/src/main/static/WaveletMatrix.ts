import { RankBitVector } from '#src/main/static/RankBitVector';

export class WaveletMatrix {
  #levels: RankBitVector[] = [];
  #zeroCounts: Uint32Array;
  #cardinality: number;
  length: number;

  constructor(values: Uint32Array, cardinality: number) {
    this.length = values.length;
    this.#cardinality = cardinality;
    const levelCount = cardinality <= 1 ? 0 : Math.ceil(Math.log2(cardinality));
    this.#zeroCounts = new Uint32Array(levelCount);
    let current = values.slice();
    let next = new Uint32Array(values.length);

    for (let level = 0; level < levelCount; level++) {
      const shift = levelCount - level - 1;
      const bits = new Uint32Array(Math.ceil(values.length / 32));
      let zeros = 0;
      for (let index = 0; index < current.length; index++) {
        if ((current[index] >>> shift) & 1) bits[index >>> 5] |= 1 << (index & 31);
        else zeros++;
      }
      this.#levels.push(new RankBitVector(values.length, bits));
      this.#zeroCounts[level] = zeros;

      let zeroIndex = 0;
      let oneIndex = zeros;
      for (const value of current) {
        if ((value >>> shift) & 1) next[oneIndex++] = value;
        else next[zeroIndex++] = value;
      }
      [current, next] = [next, current];
    }
  }

  access(index: number) {
    if (index < 0 || index >= this.length) throw new RangeError('Wavelet index out of range');
    let value = 0;
    for (let level = 0; level < this.#levels.length; level++) {
      const bits = this.#levels[level];
      const ones = bits.rank1(index);
      value <<= 1;
      if (bits.get(index)) {
        value |= 1;
        index = this.#zeroCounts[level] + ones;
      } else {
        index -= ones;
      }
    }
    return value >>> 0;
  }

  rangeKth(left: number, right: number, k: number) {
    if (left < 0 || right > this.length || left >= right) throw new RangeError('Invalid Wavelet range');
    if (k < 0 || k >= right - left) throw new RangeError('Wavelet rank out of range');
    if (this.#cardinality <= 1) return 0;

    let value = 0;
    for (let level = 0; level < this.#levels.length; level++) {
      const bits = this.#levels[level];
      const leftOnes = bits.rank1(left);
      const rightOnes = bits.rank1(right);
      const zeros = right - left - (rightOnes - leftOnes);
      value <<= 1;
      if (k < zeros) {
        left -= leftOnes;
        right -= rightOnes;
      } else {
        value |= 1;
        k -= zeros;
        left = this.#zeroCounts[level] + leftOnes;
        right = this.#zeroCounts[level] + rightOnes;
      }
    }
    return value >>> 0;
  }

  get byteLength() {
    return this.#zeroCounts.byteLength + this.#levels.reduce((sum, level) => sum + level.byteLength, 0);
  }
}
