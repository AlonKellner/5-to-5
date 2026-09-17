import { referenceDeriveRuleset, type ReferenceRuleset } from './referenceValidator';

export interface ReferenceClues {
  /** Color per cell or -1. */
  tiles: readonly number[];
  /** [a, b, delta] with delta = (color[b] - color[a]) mod 5. */
  relations: readonly (readonly [number, number, number])[];
}

export interface ReferenceSolution {
  cells: number[];
  ruleset: ReferenceRuleset;
}

/**
 * Plain row-major backtracking with only count and relation pruning, validated at the leaves by
 * the reference validator. Slow but obviously correct; used as a test oracle.
 */
export function bruteForceSolutions(clues: ReferenceClues, limit: number): ReferenceSolution[] {
  const cells = new Array<number>(25).fill(-1);
  const counts = [0, 0, 0, 0, 0];
  const solutions: ReferenceSolution[] = [];
  const relationsAt: [number, number, number][][] = Array.from({ length: 25 }, () => []);
  for (const [a, b, d] of clues.relations) {
    const last = Math.max(a, b);
    relationsAt[last]!.push([a, b, d]);
  }

  const dfs = (i: number): boolean => {
    if (i === 25) {
      const ruleset = referenceDeriveRuleset(cells);
      if (ruleset) solutions.push({ cells: [...cells], ruleset });
      return solutions.length >= limit;
    }
    const clue = clues.tiles[i]!;
    for (let color = 0; color < 5; color++) {
      if (clue >= 0 && color !== clue) continue;
      if (counts[color] === 5) continue;
      cells[i] = color;
      const ok = relationsAt[i]!.every(
        ([a, b, d]) => (((cells[b]! - cells[a]!) % 5) + 5) % 5 === d,
      );
      if (ok) {
        counts[color]!++;
        const stop = dfs(i + 1);
        counts[color]!--;
        if (stop) return true;
      }
      cells[i] = -1;
    }
    return false;
  };

  dfs(0);
  return solutions;
}
