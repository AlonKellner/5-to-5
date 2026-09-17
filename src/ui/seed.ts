/** A short random seed for a new puzzle, e.g. "k3f9x2a1". */
export function randomSeed(): string {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(values, (v) => v.toString(36).padStart(7, '0'))
    .join('')
    .slice(0, 10);
}
