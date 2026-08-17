const WORD_BITS = 32;
const BLOCK_WORDS = 8;

function popcount(value: number) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export class RankBitVector {
  #bits: Uint32Array;
  #ranks: Uint32Array;
  length: number;

  constructor(length: number, bits: Uint32Array) {
    this.length = length;
    this.#bits = bits;
    this.#ranks = new Uint32Array(Math.ceil(bits.length / BLOCK_WORDS) + 1);
    let rank = 0;
    for (let word = 0; word < bits.length; word++) {
      if (word % BLOCK_WORDS === 0) this.#ranks[word / BLOCK_WORDS] = rank;
      rank += popcount(bits[word]);
    }
    this.#ranks[this.#ranks.length - 1] = rank;
  }

  static fromPredicate(length: number, predicate: (index: number) => boolean) {
    const bits = new Uint32Array(Math.ceil(length / WORD_BITS));
    for (let index = 0; index < length; index++) {
      if (predicate(index)) bits[index >>> 5] |= 1 << (index & 31);
    }
    return new RankBitVector(length, bits);
  }

  get(index: number) {
    if (index < 0 || index >= this.length) return false;
    return !!(this.#bits[index >>> 5] & (1 << (index & 31)));
  }

  rank1(end: number) {
    end = Math.max(0, Math.min(this.length, end));
    const wordEnd = end >>> 5;
    const block = Math.floor(wordEnd / BLOCK_WORDS);
    let rank = this.#ranks[block];
    for (let word = block * BLOCK_WORDS; word < wordEnd; word++) rank += popcount(this.#bits[word]);
    const remainder = end & 31;
    if (remainder && wordEnd < this.#bits.length) {
      rank += popcount(this.#bits[wordEnd] & (0xffffffff >>> (WORD_BITS - remainder)));
    }
    return rank;
  }

  get byteLength() {
    return this.#bits.byteLength + this.#ranks.byteLength;
  }
}
