import { COLOR_COUNT } from './constants';

/** Hidden rules: must[c] is the color every copy of c touches, never[c] the color none touches. */
export interface Ruleset {
  readonly must: readonly number[];
  readonly never: readonly number[];
}

function permutationsOf(items: number[]): number[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutationsOf([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const IDENTITY = Array.from({ length: COLOR_COUNT }, (_, i) => i);

export const PERMUTATIONS: readonly (readonly number[])[] = permutationsOf(IDENTITY);

export function isInvolution(f: readonly number[]): boolean {
  return f.every((v, i) => f[v] === i);
}

export const INVOLUTIONS: readonly (readonly number[])[] = PERMUTATIONS.filter(isInvolution);

export function isValidRuleset(rs: Ruleset): boolean {
  return (
    isInvolution(rs.must) && isInvolution(rs.never) && rs.must.every((m, i) => m !== rs.never[i])
  );
}

export const VALID_RULESETS: readonly Ruleset[] = INVOLUTIONS.flatMap((must) =>
  INVOLUTIONS.map((never) => ({ must, never })),
).filter(isValidRuleset);

export function fixedPointCount(f: readonly number[]): number {
  return f.filter((v, i) => v === i).length;
}

/** Renames colors: color c becomes perm[c]. */
export function permuteRuleset(rs: Ruleset, perm: readonly number[]): Ruleset {
  const must = new Array<number>(COLOR_COUNT);
  const never = new Array<number>(COLOR_COUNT);
  for (let i = 0; i < COLOR_COUNT; i++) {
    must[perm[i]!] = perm[rs.must[i]!]!;
    never[perm[i]!] = perm[rs.never[i]!]!;
  }
  return { must, never };
}

export function rulesetKey(rs: Ruleset): string {
  return `${rs.must.join('')}|${rs.never.join('')}`;
}

export function canonicalRulesetKey(rs: Ruleset): string {
  let best = '';
  for (const perm of PERMUTATIONS) {
    const key = rulesetKey(permuteRuleset(rs, perm));
    if (best === '' || key < best) best = key;
  }
  return best;
}

const CLASS_KEYS: readonly string[] = [...new Set(VALID_RULESETS.map(canonicalRulesetKey))].sort();

export const RULESET_CLASS_COUNT = CLASS_KEYS.length;

/** Index of the relabeling-equivalence class of a ruleset (stable across runs). */
export function rulesetClass(rs: Ruleset): number {
  const index = CLASS_KEYS.indexOf(canonicalRulesetKey(rs));
  if (index < 0) throw new RangeError(`Not a valid ruleset: ${rulesetKey(rs)}`);
  return index;
}
