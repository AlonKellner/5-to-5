import { decodePuzzle, encodePuzzle } from '../core/codec';
import type { GenerateProgress } from '../core/generator/generate';
import { ratePuzzle } from '../core/generator/generate';
import {
  DIFFICULTY_NAMES,
  parseDifficulty,
  type DifficultyLevel,
  type Puzzle,
} from '../core/puzzle';
import { Rng } from '../core/rng';
import {
  canHint,
  createGame,
  deserializeGame,
  findMistakes,
  restoreCheckpoint,
  returnToTray,
  revealHint,
  revealSolution,
  saveCheckpoint,
  serializeGame,
  SPAWNER_NOTE_SLOTS,
  toggleGridNote,
  toggleSpawnerNote,
  type GameState,
} from '../game/state';
import type { PuzzleSource } from '../worker/client';
import { canUndo, commit, startHistory, undo, type History } from '../game/history';
import { byId } from './dom';
import { applyDrop, attachDragController, type DragControllerOptions } from './dragDrop';
import { mountLayout } from './layout';
import { NotesMenu } from './notesMenu';
import { renderBoard, renderSpawnerNotes, renderSpawners } from './render';

export interface AppOptions {
  root: HTMLElement;
  source: PuzzleSource;
  /** Randomness for hints. */
  rng: Rng;
  url: URL;
  onUrlChange?: (url: URL) => void;
  newSeed: () => string;
  hitTest?: DragControllerOptions['hitTest'];
  clipboard?: { writeText(text: string): Promise<void> };
  /** Keeps the current game across reloads. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export const STORAGE_KEY = '5-to-5:game';

const DEFAULT_DIFFICULTY: DifficultyLevel = 3;

const levelLabel = (level: DifficultyLevel) => `${DIFFICULTY_NAMES[level]} (${level}/7)`;

function describeProgress(difficulty: DifficultyLevel, progress?: GenerateProgress): string {
  const base = `Generating a ${DIFFICULTY_NAMES[difficulty].toLowerCase()} puzzle…`;
  if (!progress) return base;
  if (progress.phase === 'clues') return `${base} choosing clues`;
  return `${base} ${(progress.trials / 1e6).toFixed(1)}M boards tried`;
}

export class App {
  private history: History | null = null;
  private mistakes: ReadonlySet<number> = new Set();
  private statusIsCheck = false;
  private puzzle: Puzzle | null = null;
  private puzzleCode = '';
  private difficulty: DifficultyLevel = DEFAULT_DIFFICULTY;
  private readonly notesMenu: NotesMenu;
  private readonly detachDrag: () => void;
  private readonly el: Record<string, HTMLElement>;

  constructor(private readonly options: AppOptions) {
    const { root } = options;
    mountLayout(root);
    const ids = [
      'game-board',
      'relationship-clues-container',
      'spawner-grid',
      'spawner-clues-container',
      'spawner-notes-grid',
      'difficulty-select',
      'new-btn',
      'reset-btn',
      'clue-btn',
      'reveal-btn',
      'undo-btn',
      'check-btn',
      'checkpoint-btn',
      'restore-btn',
      'status',
      'puzzle-info',
      'share-btn',
      'win-modal',
      'close-win-modal-btn',
    ];
    this.el = Object.fromEntries(ids.map((id) => [id, byId(root, id)]));
    this.notesMenu = new NotesMenu(root.ownerDocument);

    this.detachDrag = attachDragController({
      root,
      hitTest: options.hitTest,
      onDrop: (source, target) => this.update((s) => applyDrop(s, source, target)),
      onClick: (source) => {
        if (source.kind === 'cell') this.update((s) => returnToTray(s, source.cell));
      },
    });
    root.addEventListener('click', this.onNoteClick);
    root.ownerDocument.addEventListener('keydown', this.onKeyDown);

    this.on('difficulty-select', 'change', () => {
      const value = parseDifficulty((this.el['difficulty-select'] as HTMLSelectElement).value);
      if (value) this.difficulty = value;
    });
    this.on('new-btn', 'click', () => void this.newPuzzle(this.difficulty));
    this.on('reset-btn', 'click', () => this.puzzle && this.setState(createGame(this.puzzle)));
    this.on('clue-btn', 'click', () => this.update((s) => revealHint(s, options.rng)));
    this.on('reveal-btn', 'click', () => this.update(revealSolution));
    this.on('undo-btn', 'click', () => this.undo());
    this.on('check-btn', 'click', () => this.check());
    this.on('checkpoint-btn', 'click', () => this.update(saveCheckpoint));
    this.on('restore-btn', 'click', () => this.update(restoreCheckpoint));
    this.on('share-btn', 'click', () => void this.share());
    this.on('close-win-modal-btn', 'click', () => {
      this.el['win-modal']!.hidden = true;
    });
  }

  async start(): Promise<void> {
    const params = this.options.url.searchParams;
    this.difficulty = parseDifficulty(params.get('d')) ?? this.difficulty;
    const code = params.get('p');
    if (code) {
      try {
        const decoded = decodePuzzle(code);
        const rating = ratePuzzle(decoded.solution, decoded.mask);
        this.load({ ...decoded, rating });
        return;
      } catch {
        this.setStatus('That puzzle link is invalid, generating a new puzzle.');
      }
    }
    await this.newPuzzle(this.difficulty, params.get('seed') ?? undefined);
  }

  async newPuzzle(difficulty: DifficultyLevel, seed = this.options.newSeed()): Promise<void> {
    this.difficulty = difficulty;
    this.setStatus(describeProgress(difficulty));
    (this.el['new-btn'] as HTMLButtonElement).disabled = true;
    try {
      const puzzle = await this.options.source.generate(seed, difficulty, (progress) =>
        this.setStatus(describeProgress(difficulty, progress)),
      );
      this.load(puzzle);
      this.setStatus('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel/i.test(message)) this.setStatus(`Could not generate a puzzle: ${message}`);
    } finally {
      (this.el['new-btn'] as HTMLButtonElement).disabled = false;
    }
  }

  destroy(): void {
    this.detachDrag();
    this.notesMenu.close();
    this.options.root.removeEventListener('click', this.onNoteClick);
    this.options.root.ownerDocument.removeEventListener('keydown', this.onKeyDown);
  }

  private load(puzzle: Puzzle): void {
    this.puzzle = puzzle;
    if (puzzle.rating) this.difficulty = puzzle.rating.level;
    (this.el['difficulty-select'] as HTMLSelectElement).value = String(this.difficulty);
    this.el['puzzle-info']!.textContent = puzzle.rating
      ? `${levelLabel(puzzle.rating.level)} · score ${puzzle.rating.score}`
      : '';
    this.el['win-modal']!.hidden = true;
    this.puzzleCode = encodePuzzle(puzzle);
    this.history = startHistory(this.savedGame(puzzle) ?? createGame(puzzle));
    this.mistakes = new Set();
    this.render();
    this.save(this.history.present);
    const url = new URL(this.options.url);
    url.search = '';
    url.searchParams.set('p', this.puzzleCode);
    url.searchParams.set('d', String(this.difficulty));
    this.options.url = url;
    this.options.onUrlChange?.(url);
  }

  private get state(): GameState | null {
    return this.history?.present ?? null;
  }

  private update(change: (state: GameState) => GameState): void {
    if (this.state) this.setState(change(this.state));
  }

  private setState(next: GameState): void {
    if (!this.history || next === this.history.present) return;
    const previous = this.history.present;
    this.history = commit(this.history, next);
    if (previous.status === 'playing' && next.status === 'won') {
      this.el['win-modal']!.hidden = false;
    }
    this.afterChange();
  }

  private undo(): void {
    if (!this.history || this.history.present.status !== 'playing' || !canUndo(this.history)) {
      return;
    }
    this.history = undo(this.history);
    this.afterChange();
  }

  private afterChange(): void {
    this.mistakes = new Set();
    if (this.statusIsCheck) this.setStatus('');
    this.render();
    this.save(this.history!.present);
  }

  private check(): void {
    const state = this.state;
    if (!state) return;
    const mistakes = findMistakes(state);
    this.mistakes = new Set(mistakes);
    this.render();
    this.setStatus(
      mistakes.length === 0
        ? 'No mistakes so far.'
        : `${mistakes.length} ${mistakes.length === 1 ? 'tile is' : 'tiles are'} wrong.`,
    );
    this.statusIsCheck = true;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select')) return;
      event.preventDefault();
      this.undo();
    }
  };

  private savedGame(puzzle: Puzzle): GameState | null {
    try {
      const raw = this.options.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { code?: string; game?: unknown };
      return saved.code === this.puzzleCode ? deserializeGame(puzzle, saved.game) : null;
    } catch {
      return null;
    }
  }

  private save(state: GameState): void {
    try {
      this.options.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({ code: this.puzzleCode, game: serializeGame(state) }),
      );
    } catch {
      // Storage can be unavailable (private browsing, quota); the game still works without it.
    }
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    renderBoard(
      this.el['game-board']!,
      this.el['relationship-clues-container']!,
      state,
      this.mistakes,
    );
    renderSpawners(this.el['spawner-grid']!, this.el['spawner-clues-container']!, state);
    renderSpawnerNotes(this.el['spawner-notes-grid']!, state);
    const playing = state.status === 'playing';
    for (const id of [
      'reset-btn',
      'clue-btn',
      'reveal-btn',
      'undo-btn',
      'check-btn',
      'checkpoint-btn',
    ]) {
      this.el[id]!.hidden = !playing;
    }
    this.el['restore-btn']!.hidden = !playing || !state.checkpoint;
    (this.el['clue-btn'] as HTMLButtonElement).disabled = !canHint(state);
    (this.el['undo-btn'] as HTMLButtonElement).disabled = !canUndo(this.history!);
  }

  private readonly onNoteClick = (event: MouseEvent) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-note]');
    if (!target || !this.state) return;
    const point = { x: event.clientX, y: event.clientY };
    if (target.dataset['note'] === 'cell') {
      const cell = Number(target.dataset['cell']);
      this.notesMenu.open(point, this.state.gridNotes[cell]!, (color) => {
        this.update((s) => toggleGridNote(s, cell, color));
        return this.state!.gridNotes[cell]!;
      });
    } else {
      const color = Number(target.dataset['color']);
      const slot = Number(target.dataset['slot']);
      const index = color * SPAWNER_NOTE_SLOTS + slot;
      this.notesMenu.open(point, this.state.spawnerNotes[index]!, (noteColor) => {
        this.update((s) => toggleSpawnerNote(s, color, slot, noteColor));
        return this.state!.spawnerNotes[index]!;
      });
    }
  };

  private async share(): Promise<void> {
    try {
      await this.options.clipboard?.writeText(this.options.url.toString());
      this.setStatus('Link copied to the clipboard.');
    } catch {
      this.setStatus(this.options.url.toString());
    }
  }

  private setStatus(text: string): void {
    this.statusIsCheck = false;
    this.el['status']!.textContent = text;
  }

  private on(id: string, type: string, handler: () => void): void {
    this.el[id]!.addEventListener(type, handler);
  }
}
