import { boardFromKey, boardKey, colorCounts } from './board';
import { SLOT_COUNT } from './clues';
import type { Puzzle } from './puzzle';

const VERSION = '1';
const BOARD_BYTES = 8;
const MASK_BYTES = Math.ceil(SLOT_COUNT / 8);
const MAX_BOARD_KEY = 5n ** 25n;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new SyntaxError('Invalid puzzle code characters');
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/** Compact, URL-safe encoding of a puzzle's solution and clue mask. */
export function encodePuzzle(puzzle: Pick<Puzzle, 'solution' | 'mask'>): string {
  const bytes = new Uint8Array(BOARD_BYTES + MASK_BYTES);
  let key = boardKey(puzzle.solution);
  for (let i = BOARD_BYTES - 1; i >= 0; i--) {
    bytes[i] = Number(key & 0xffn);
    key >>= 8n;
  }
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (puzzle.mask[slot]) bytes[BOARD_BYTES + (slot >> 3)]! |= 1 << (slot & 7);
  }
  return VERSION + toBase64Url(bytes);
}

export function decodePuzzle(code: string): Pick<Puzzle, 'solution' | 'mask'> {
  if (!code.startsWith(VERSION)) throw new SyntaxError('Unsupported puzzle code version');
  const bytes = fromBase64Url(code.slice(VERSION.length));
  if (bytes.length !== BOARD_BYTES + MASK_BYTES)
    throw new SyntaxError('Invalid puzzle code length');
  let key = 0n;
  for (let i = 0; i < BOARD_BYTES; i++) key = (key << 8n) | BigInt(bytes[i]!);
  if (key >= MAX_BOARD_KEY) throw new SyntaxError('Invalid board in puzzle code');
  const solution = boardFromKey(key);
  if (![...colorCounts(solution)].every((n) => n === 5)) {
    throw new SyntaxError('Puzzle code board must have five tiles of each color');
  }
  const mask = new Uint8Array(SLOT_COUNT);
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    mask[slot] = (bytes[BOARD_BYTES + (slot >> 3)]! >> (slot & 7)) & 1;
  }
  if (bytes[bytes.length - 1]! >> (SLOT_COUNT & 7) !== 0) {
    throw new SyntaxError('Invalid clue mask in puzzle code');
  }
  return { solution, mask };
}
