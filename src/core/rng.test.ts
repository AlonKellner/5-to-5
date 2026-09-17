import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng('hello');
    const b = new Rng('hello');
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    const seqB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng('seed-1');
    const b = new Rng('seed-2');
    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    const seqB = Array.from({ length: 5 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it('is stable across releases (snapshot of the first values)', () => {
    const rng = new Rng('5-to-5');
    expect(Array.from({ length: 6 }, () => rng.nextUint32())).toMatchSnapshot();
  });

  it('nextUint32 stays within the unsigned 32-bit range', () => {
    const rng = new Rng('range');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextUint32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    }
  });

  it('nextFloat is in [0, 1)', () => {
    const rng = new Rng('float');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(n) is in range and approximately uniform (chi-square)', () => {
    const rng = new Rng('uniform');
    const n = 7;
    const draws = 140_000;
    const counts = new Array<number>(n).fill(0);
    for (let i = 0; i < draws; i++) {
      const v = rng.nextInt(n);
      expect(v >= 0 && v < n).toBe(true);
      counts[v]!++;
    }
    const expected = draws / n;
    const chi2 = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // 6 degrees of freedom: p = 0.001 critical value is 22.46
    expect(chi2).toBeLessThan(22.46);
  });

  it('nextInt rejects invalid bounds', () => {
    const rng = new Rng('bad');
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(2.5)).toThrow();
    expect(() => rng.nextInt(2 ** 22)).toThrow();
  });

  it('shuffle preserves the multiset of elements', () => {
    const rng = new Rng('shuffle');
    const arr = [0, 0, 1, 1, 2, 3, 4, 4, 4];
    const shuffled = rng.shuffle([...arr]);
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });

  it('shuffle works on typed arrays in place', () => {
    const rng = new Rng('typed');
    const arr = Uint8Array.from([1, 2, 3, 4, 5]);
    const result = rng.shuffle(arr);
    expect(result).toBe(arr);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('shuffle generates all permutations of 3 elements uniformly', () => {
    const rng = new Rng('perm');
    const counts = new Map<string, number>();
    const draws = 60_000;
    for (let i = 0; i < draws; i++) {
      const key = rng.shuffle([0, 1, 2]).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    const expected = draws / 6;
    const chi2 = [...counts.values()].reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
    // 5 degrees of freedom: p = 0.001 critical value is 20.52
    expect(chi2).toBeLessThan(20.52);
  });

  it('pick returns an element of the array', () => {
    const rng = new Rng('pick');
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(arr).toContain(rng.pick(arr));
    expect(() => rng.pick([])).toThrow();
  });

  it('split creates an independent but deterministic child stream', () => {
    const parent1 = new Rng('parent');
    const parent2 = new Rng('parent');
    const child1 = parent1.split();
    const child2 = parent2.split();
    expect(child1.nextUint32()).toBe(child2.nextUint32());
    expect(parent1.nextUint32()).toBe(parent2.nextUint32());
  });
});
