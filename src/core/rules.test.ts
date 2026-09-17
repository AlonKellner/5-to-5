import { describe, expect, it } from 'vitest';
import { HTML_RULESET } from '../../test/fixtures/legacy';
import {
  canonicalRulesetKey,
  fixedPointCount,
  INVOLUTIONS,
  isInvolution,
  isValidRuleset,
  PERMUTATIONS,
  permuteRuleset,
  RULESET_CLASS_COUNT,
  rulesetClass,
  VALID_RULESETS,
} from './rules';

describe('rule space', () => {
  it('has 120 color permutations', () => {
    expect(PERMUTATIONS).toHaveLength(120);
    expect(new Set(PERMUTATIONS.map((p) => p.join(''))).size).toBe(120);
  });

  it('has 26 involutions on 5 colors', () => {
    expect(INVOLUTIONS).toHaveLength(26);
    for (const f of INVOLUTIONS) expect(isInvolution(f)).toBe(true);
  });

  it('detects non-involutions', () => {
    expect(isInvolution([1, 2, 0, 3, 4])).toBe(false);
    expect(isInvolution([0, 0, 2, 3, 4])).toBe(false);
  });

  it('has 240 valid (must, never) pairs', () => {
    expect(VALID_RULESETS).toHaveLength(240);
    for (const rs of VALID_RULESETS) expect(isValidRuleset(rs)).toBe(true);
  });

  it('rejects rulesets where must equals never for some color', () => {
    expect(isValidRuleset({ must: [0, 1, 2, 3, 4], never: [0, 2, 1, 4, 3] })).toBe(false);
  });

  it('only allows fixed-point counts (1,1), (1,3) and (3,1)', () => {
    const combos = new Set(
      VALID_RULESETS.map((rs) => `${fixedPointCount(rs.must)},${fixedPointCount(rs.never)}`),
    );
    expect([...combos].sort()).toEqual(['1,1', '1,3', '3,1']);
  });

  it('has exactly 3 classes under color relabeling, with sizes 60, 60 and 120', () => {
    expect(RULESET_CLASS_COUNT).toBe(3);
    const sizes = [0, 0, 0];
    for (const rs of VALID_RULESETS) sizes[rulesetClass(rs)]!++;
    expect([...sizes].sort((a, b) => a - b)).toEqual([60, 60, 120]);
  });

  it('keeps the class invariant under relabeling', () => {
    for (const perm of PERMUTATIONS) {
      const permuted = permuteRuleset(HTML_RULESET, perm);
      expect(isValidRuleset(permuted)).toBe(true);
      expect(canonicalRulesetKey(permuted)).toBe(canonicalRulesetKey(HTML_RULESET));
      expect(rulesetClass(permuted)).toBe(rulesetClass(HTML_RULESET));
    }
  });

  it('relabels consistently: must[perm[i]] = perm[must[i]]', () => {
    const perm = [2, 0, 4, 1, 3];
    const permuted = permuteRuleset(HTML_RULESET, perm);
    for (let i = 0; i < 5; i++) {
      expect(permuted.must[perm[i]!]).toBe(perm[HTML_RULESET.must[i]!]);
      expect(permuted.never[perm[i]!]).toBe(perm[HTML_RULESET.never[i]!]);
    }
  });
});
