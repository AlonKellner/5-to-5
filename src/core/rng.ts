const TWO_POW_32 = 4294967296;
const MAX_INT_BOUND = 2 ** 21;

/** Hashes a string into four 32-bit seeds (cyrb128). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

interface MutableIndexable<T> {
  length: number;
  [index: number]: T;
}

/**
 * Seedable PRNG (sfc32). Uses only 32-bit integer arithmetic, so a seed produces the
 * same sequence in every JavaScript engine.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string | readonly [number, number, number, number]) {
    const [a, b, c, d] = typeof seed === 'string' ? cyrb128(seed) : seed;
    this.a = a | 0;
    this.b = b | 0;
    this.c = c | 0;
    this.d = d | 0;
    for (let i = 0; i < 15; i++) this.nextUint32();
  }

  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / TWO_POW_32;
  }

  /** Unbiased integer in [0, n) using Lemire's multiply-and-reject method. */
  nextInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > MAX_INT_BOUND) {
      throw new RangeError(`nextInt bound must be an integer in [1, ${MAX_INT_BOUND}], got ${n}`);
    }
    const threshold = (TWO_POW_32 - n) % n;
    for (;;) {
      const m = this.nextUint32() * n;
      if (m % TWO_POW_32 >= threshold) return Math.floor(m / TWO_POW_32);
    }
  }

  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<A extends MutableIndexable<unknown>>(arr: A): A {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('Cannot pick from an empty array');
    return arr[this.nextInt(arr.length)]!;
  }

  /** Derives an independent child generator, advancing this one deterministically. */
  split(): Rng {
    return new Rng([this.nextUint32(), this.nextUint32(), this.nextUint32(), this.nextUint32()]);
  }
}
