import { EDGE_COUNT, EDGES, type ClueSet } from '../clues';
import {
  ALL_COLORS_MASK,
  CELL_COUNT,
  COLOR_COUNT,
  NEIGHBOR_TABLE,
  TILES_PER_COLOR,
} from '../constants';
import { VALID_RULESETS } from '../rules';
import { bitIndex, isSingleton, POPCOUNT, ROTATE } from './bits';
import { MUST, NEVER, type SolverState } from './state';

/** Deduction strength; each level includes all lower ones. */
export const LEVEL = {
  /** Five tiles per color and relation clues. */
  COUNTS: 0,
  /** Never-neighbor reasoning plus rule consistency (involutions, must ≠ never). */
  NEVER: 1,
  /** Must-neighbor reasoning. */
  MUST: 2,
  /** Exactness: only one color may be missing / common for each color. */
  EXACT: 3,
} as const;
export const MAX_LEVEL = LEVEL.EXACT;

const EDGE_A = Int8Array.from(EDGES, (e) => e.a);
const EDGE_B = Int8Array.from(EDGES, (e) => e.b);

/** Each valid ruleset with one bit per color slot: bit (5 * color + rule[color]). */
const PACKED_MUST = Int32Array.from(VALID_RULESETS, (rs) =>
  rs.must.reduce((acc, m, c) => acc | (1 << (5 * c + m)), 0),
);
const PACKED_NEVER = Int32Array.from(VALID_RULESETS, (rs) =>
  rs.never.reduce((acc, n, c) => acc | (1 << (5 * c + n)), 0),
);

const definite = new Uint8Array(CELL_COUNT);
const union = new Uint8Array(CELL_COUNT);
const fixedCount = new Uint8Array(COLOR_COUNT);

function packDomains(s: SolverState, offset: number): number {
  let packed = 0;
  for (let c = 0; c < COLOR_COUNT; c++) packed |= s[offset + c]! << (5 * c);
  return packed;
}

function unpackDomains(s: SolverState, offset: number, packed: number): void {
  for (let c = 0; c < COLOR_COUNT; c++) s[offset + c] = (packed >>> (5 * c)) & ALL_COLORS_MASK;
}

/**
 * Removes candidates that cannot appear in any valid solution, up to the given level, until a
 * fixpoint. Mutates `s`. Returns false if a contradiction was found.
 */
export function propagate(s: SolverState, clues: ClueSet, level: number): boolean {
  const relations = clues.relations;
  let lastMust = -1;
  let lastNever = -1;

  for (;;) {
    let changed = false;

    for (let e = 0; e < EDGE_COUNT; e++) {
      const d = relations[e]!;
      if (d < 0) continue;
      const a = EDGE_A[e]!;
      const b = EDGE_B[e]!;
      const ma = s[a]!;
      const mb = s[b]!;
      const nb = mb & ROTATE[d * 32 + ma]!;
      const na = ma & ROTATE[((COLOR_COUNT - d) % COLOR_COUNT) * 32 + mb]!;
      if (nb !== mb) {
        if (nb === 0) return false;
        s[b] = nb;
        changed = true;
      }
      if (na !== ma) {
        if (na === 0) return false;
        s[a] = na;
        changed = true;
      }
    }

    for (let c = 0; c < COLOR_COUNT; c++) {
      const bit = 1 << c;
      let candidates = 0;
      let fixed = 0;
      for (let x = 0; x < CELL_COUNT; x++) {
        const m = s[x]!;
        if (m & bit) {
          candidates++;
          if (m === bit) fixed++;
        }
      }
      if (candidates < TILES_PER_COLOR || fixed > TILES_PER_COLOR) return false;
      if (fixed === TILES_PER_COLOR && candidates > TILES_PER_COLOR) {
        for (let x = 0; x < CELL_COUNT; x++) if (s[x]! & bit && s[x] !== bit) s[x]! &= ~bit;
        changed = true;
      } else if (candidates === TILES_PER_COLOR && fixed < TILES_PER_COLOR) {
        for (let x = 0; x < CELL_COUNT; x++) if (s[x]! & bit) s[x] = bit;
        fixed = TILES_PER_COLOR;
        changed = true;
      }
      fixedCount[c] = fixed;
    }

    if (level >= LEVEL.NEVER) {
      for (let x = 0; x < CELL_COUNT; x++) {
        let d = 0;
        let u = 0;
        for (let k = x * 4, end = k + 4; k < end; k++) {
          const n = NEIGHBOR_TABLE[k]!;
          if (n < 0) break;
          const m = s[n]!;
          u |= m;
          if (isSingleton(m)) d |= m;
        }
        definite[x] = d;
        union[x] = u;
      }

      // A placed tile rules out every color it definitely touches as its never-neighbor, and a
      // color can only sit where some never-neighbor candidate is not already adjacent.
      for (let x = 0; x < CELL_COUNT; x++) {
        let m = s[x]!;
        const d = definite[x]!;
        if (isSingleton(m)) {
          const c = bitIndex(m);
          const nd = s[NEVER + c]! & ~d;
          if (nd === 0) return false;
          if (nd !== s[NEVER + c]) {
            s[NEVER + c] = nd;
            changed = true;
          }
        } else {
          for (let c = 0; c < COLOR_COUNT; c++) {
            if (m & (1 << c) && (s[NEVER + c]! & ~d) === 0) m &= ~(1 << c);
          }
          if (m !== s[x]) {
            if (m === 0) return false;
            s[x] = m;
            changed = true;
          }
        }
      }

      if (level >= LEVEL.MUST) {
        for (let x = 0; x < CELL_COUNT; x++) {
          let m = s[x]!;
          const u = union[x]!;
          for (let c = 0; c < COLOR_COUNT; c++) {
            if (m & (1 << c) && (s[MUST + c]! & u) === 0) m &= ~(1 << c);
          }
          if (m !== s[x]) {
            if (m === 0) return false;
            s[x] = m;
            changed = true;
          }
          if (!isSingleton(m)) continue;
          const c = bitIndex(m);
          const md = s[MUST + c]! & u;
          if (md !== s[MUST + c]) {
            s[MUST + c] = md;
            changed = true;
          }
          if (isSingleton(md) && (definite[x]! & md) === 0) {
            let supplier = -1;
            let suppliers = 0;
            for (let k = x * 4, end = k + 4; k < end; k++) {
              const n = NEIGHBOR_TABLE[k]!;
              if (n < 0) break;
              if (s[n]! & md) {
                suppliers++;
                supplier = n;
              }
            }
            if (suppliers === 0) return false;
            if (suppliers === 1 && s[supplier] !== md) {
              s[supplier] = md;
              changed = true;
            }
          }
        }
      }

      if (level >= LEVEL.EXACT) {
        for (let c = 0; c < COLOR_COUNT; c++) {
          const bit = 1 << c;
          let adjacent = 0;
          let commonSure = ALL_COLORS_MASK;
          for (let x = 0; x < CELL_COUNT; x++) {
            const m = s[x]!;
            if (!(m & bit)) continue;
            adjacent |= union[x]!;
            if (m === bit) commonSure &= definite[x]!;
          }
          // Colors that cannot touch c are all missing from c's neighborhood; only one may be.
          const notAdjacent = ALL_COLORS_MASK & ~adjacent;
          if (notAdjacent !== 0) {
            if (!isSingleton(notAdjacent)) return false;
            const nd = s[NEVER + c]! & notAdjacent;
            if (nd === 0) return false;
            if (nd !== s[NEVER + c]) {
              s[NEVER + c] = nd;
              changed = true;
            }
          }
          // Once every copy is placed, colors definitely touching all of them are common; only one may be.
          if (fixedCount[c] === TILES_PER_COLOR && commonSure !== 0) {
            if (POPCOUNT[commonSure]! > 1) return false;
            const md = s[MUST + c]! & commonSure;
            if (md === 0) return false;
            if (md !== s[MUST + c]) {
              s[MUST + c] = md;
              changed = true;
            }
          }
        }
      }

      const mustPacked = packDomains(s, MUST);
      const neverPacked = packDomains(s, NEVER);
      if (mustPacked !== lastMust || neverPacked !== lastNever) {
        let newMust = 0;
        let newNever = 0;
        for (let r = 0; r < PACKED_MUST.length; r++) {
          const pm = PACKED_MUST[r]!;
          const pn = PACKED_NEVER[r]!;
          if ((mustPacked & pm) === pm && (neverPacked & pn) === pn) {
            newMust |= pm;
            newNever |= pn;
          }
        }
        if (newMust === 0) return false;
        if (newMust !== mustPacked || newNever !== neverPacked) {
          unpackDomains(s, MUST, newMust);
          unpackDomains(s, NEVER, newNever);
          changed = true;
        }
        lastMust = newMust;
        lastNever = newNever;
      }
    }

    if (!changed) return true;
  }
}
