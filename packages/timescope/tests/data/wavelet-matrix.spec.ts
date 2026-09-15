import { RankBitVector } from '#src/core/RankBitVector';
import { WaveletMatrix } from '#src/core/WaveletMatrix';
import { describe, expect, it } from 'vitest';

describe('RankBitVector', () => {
  it('matches a boolean rank oracle across word and block boundaries', () => {
    const values = Array.from({ length: 600 }, (_, index) => index % 3 === 0 || index % 17 === 0);
    const vector = RankBitVector.fromPredicate(values.length, (index) => values[index]);

    for (let end = 0; end <= values.length; end++) {
      expect(vector.rank1(end)).toBe(values.slice(0, end).filter(Boolean).length);
    }
    for (let index = 0; index < values.length; index++) expect(vector.get(index)).toBe(values[index]);
  });
});

describe('WaveletMatrix', () => {
  it('supports access and range kth with duplicates', () => {
    const values = Uint32Array.from([5, 1, 7, 1, 3, 5, 0, 7, 2]);
    const matrix = new WaveletMatrix(values, 8);

    for (let index = 0; index < values.length; index++) expect(matrix.access(index)).toBe(values[index]);
    for (let left = 0; left < values.length; left++) {
      for (let right = left + 1; right <= values.length; right++) {
        const sorted = [...values.slice(left, right)].sort((a, b) => a - b);
        for (let k = 0; k < sorted.length; k++) expect(matrix.rangeKth(left, right, k)).toBe(sorted[k]);
      }
    }
  });

  it('handles an all-equal sequence without levels', () => {
    const matrix = new WaveletMatrix(Uint32Array.from([0, 0, 0]), 1);
    expect(matrix.access(1)).toBe(0);
    expect(matrix.rangeKth(0, 3, 2)).toBe(0);
  });
});
