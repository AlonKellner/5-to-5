/**
 * Deliberately naive, set-based implementation of the strict 5-to-5 validity rule.
 * It shares no code with src/ so it can serve as an oracle in tests.
 */
export interface ReferenceRuleset {
  must: number[];
  never: number[];
}

export function referenceNeighbors(index: number): number[] {
  const r = Math.floor(index / 5);
  const c = index % 5;
  const out: number[] = [];
  if (r > 0) out.push(index - 5);
  if (r < 4) out.push(index + 5);
  if (c > 0) out.push(index - 1);
  if (c < 4) out.push(index + 1);
  return out;
}

export function referenceDeriveRuleset(cells: readonly number[]): ReferenceRuleset | null {
  for (let color = 0; color < 5; color++) {
    if (cells.filter((c) => c === color).length !== 5) return null;
  }
  const must: number[] = [];
  const never: number[] = [];
  for (let color = 0; color < 5; color++) {
    const positions = cells.flatMap((c, i) => (c === color ? [i] : []));
    const neighborSets = positions.map((p) => new Set(referenceNeighbors(p).map((n) => cells[n]!)));
    const common = [0, 1, 2, 3, 4].filter((c) => neighborSets.every((s) => s.has(c)));
    const missing = [0, 1, 2, 3, 4].filter((c) => neighborSets.every((s) => !s.has(c)));
    if (common.length !== 1 || missing.length !== 1) return null;
    must.push(common[0]!);
    never.push(missing[0]!);
  }
  for (let i = 0; i < 5; i++) {
    if (must[must[i]!] !== i || never[never[i]!] !== i || must[i] === never[i]) return null;
  }
  return { must, never };
}
