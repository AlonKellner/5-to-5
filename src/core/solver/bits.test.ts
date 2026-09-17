import { describe, expect, it } from 'vitest';
import { bitIndex, colorsOf, isSingleton, POPCOUNT, rotateMask } from './bits';

describe('bit helpers', () => {
  it('counts bits for every 5-bit mask', () => {
    for (let m = 0; m < 32; m++) {
      expect(POPCOUNT[m]).toBe(
        m
          .toString(2)
          .split('')
          .filter((ch) => ch === '1').length,
      );
    }
  });

  it('detects singletons and their index', () => {
    expect(isSingleton(0)).toBe(false);
    expect(isSingleton(0b00100)).toBe(true);
    expect(isSingleton(0b00110)).toBe(false);
    expect(bitIndex(0b10000)).toBe(4);
    expect(bitIndex(0b00001)).toBe(0);
  });

  it('lists the colors in a mask', () => {
    expect(colorsOf(0b10101)).toEqual([0, 2, 4]);
    expect(colorsOf(0)).toEqual([]);
  });

  it('rotates masks cyclically for every mask and delta', () => {
    for (let m = 0; m < 32; m++) {
      for (let d = 0; d < 5; d++) {
        const expected = colorsOf(m).reduce((acc, c) => acc | (1 << ((c + d) % 5)), 0);
        expect(rotateMask(m, d)).toBe(expected);
      }
    }
  });
});
