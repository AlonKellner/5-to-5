import { COLOR_COUNT } from '../constants';

const MASKS = 1 << COLOR_COUNT;

export const POPCOUNT: Uint8Array = Uint8Array.from({ length: MASKS }, (_, m) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
});

/** ROTATE[delta * 32 + mask]: the mask with every color c replaced by (c + delta) mod 5. */
export const ROTATE: Uint8Array = (() => {
  const table = new Uint8Array(COLOR_COUNT * MASKS);
  for (let d = 0; d < COLOR_COUNT; d++) {
    for (let m = 0; m < MASKS; m++) {
      let out = 0;
      for (let c = 0; c < COLOR_COUNT; c++) if (m & (1 << c)) out |= 1 << ((c + d) % COLOR_COUNT);
      table[d * MASKS + m] = out;
    }
  }
  return table;
})();

export const rotateMask = (mask: number, delta: number): number => ROTATE[delta * MASKS + mask]!;

export const isSingleton = (mask: number): boolean => mask !== 0 && (mask & (mask - 1)) === 0;

export const bitIndex = (mask: number): number => 31 - Math.clz32(mask);

export function colorsOf(mask: number): number[] {
  const colors: number[] = [];
  for (let c = 0; c < COLOR_COUNT; c++) if (mask & (1 << c)) colors.push(c);
  return colors;
}
