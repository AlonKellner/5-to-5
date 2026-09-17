import { describe, expect, it } from 'vitest';
import { randomSeed } from './seed';

describe('randomSeed', () => {
  it('returns short URL-safe seeds that differ between calls', () => {
    const seeds = new Set(Array.from({ length: 50 }, randomSeed));
    expect(seeds.size).toBe(50);
    for (const seed of seeds) expect(seed).toMatch(/^[0-9a-z]{10}$/);
  });
});
