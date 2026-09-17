import { describe, expect, it } from 'vitest';
import { chiSquarePValue, goodnessOfFit } from './stats';

describe('chi-square helpers', () => {
  it('matches known critical values', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(11.07, 5)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(23.21, 10)).toBeCloseTo(0.01, 3);
    expect(chiSquarePValue(0, 4)).toBeCloseTo(1, 6);
  });

  it('accepts a perfect fit and rejects a bad one', () => {
    expect(goodnessOfFit({ a: 500, b: 500 }, { a: 1, b: 1 }).pValue).toBeCloseTo(1, 6);
    expect(goodnessOfFit({ a: 700, b: 300 }, { a: 1, b: 1 }).pValue).toBeLessThan(1e-6);
  });

  it('pools bins with small expected counts', () => {
    const fit = goodnessOfFit({ a: 98, b: 1, c: 1 }, { a: 0.98, b: 0.01, c: 0.01 });
    expect(fit.df).toBe(1);
  });
});
