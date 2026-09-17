import { decodePuzzle, encodePuzzle } from '../core/codec';
import type { GenerateProgress } from '../core/generator/generate';
import { ratePuzzle } from '../core/generator/generate';
import { DIFFICULTY_LEVELS, type DifficultyLevel, type Puzzle } from '../core/puzzle';
import { Rng } from '../core/rng';
import {
  canHint,
  createGame,
  restoreCheckpoint,
  returnToTray,
  revealHint,
  revealSolution,
  saveCheckpoint,
  SPAWNER_NOTE_SLOTS,
  toggleGridNote,
  toggleSpawnerNote,
  type GameState,
} from '../game/state';
import type { PuzzleSource } from '../worker/client';
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
}

const DEFAULT_DIFFICULTY: DifficultyLevel = 'medium';

const capitalize = (text: string) => text[0]!.toUpperCase() + text.slice(1);

function isDifficulty(value: string | null): value is DifficultyLevel {
  return DIFFICULTY_LEVELS.includes(value as DifficultyLevel);
}

function describeProgress(difficulty: DifficultyLevel, progress?: GenerateProgress): string {
  const base = `Generating ${difficulty} puzzle…`;
  if (!progress) return base;
  if (progress.phase === 'clues') return `${base} choosing clues`;
  return `${base} ${(progress.trials / 1e6).toFixed(1)}M boards tried`;
}

export class App {
  private state: GameState | null = null;
  private puzzle: Puzzle | null = null;
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

    this.on('difficulty-select', 'change', () => {
      const value = (this.el['difficulty-select'] as HTMLSelectElement).value;
      if (isDifficulty(value)) this.difficulty = value;
    });
    this.on('new-btn', 'click', () => void this.newPuzzle(this.difficulty));
    this.on('reset-btn', 'click', () => this.puzzle && this.setState(createGame(this.puzzle)));
    this.on('clue-btn', 'click', () => this.update((s) => revealHint(s, options.rng)));
    this.on('reveal-btn', 'click', () => this.update(revealSolution));
    this.on('checkpoint-btn', 'click', () => this.update(saveCheckpoint));
    this.on('restore-btn', 'click', () => this.update(restoreCheckpoint));
    this.on('share-btn', 'click', () => void this.share());
    this.on('close-win-modal-btn', 'click', () => {
      this.el['win-modal']!.hidden = true;
    });
  }

  async start(): Promise<void> {
    const params = this.options.url.searchParams;
    const d = params.get('d');
    if (isDifficulty(d)) this.difficulty = d;
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
  }

  private load(puzzle: Puzzle): void {
    this.puzzle = puzzle;
    if (puzzle.rating) this.difficulty = puzzle.rating.level;
    (this.el['difficulty-select'] as HTMLSelectElement).value = this.difficulty;
    this.el['puzzle-info']!.textContent = puzzle.rating
      ? `${capitalize(puzzle.rating.level)} · score ${puzzle.rating.score}`
      : '';
    this.el['win-modal']!.hidden = true;
    this.setState(createGame(puzzle));
    const url = new URL(this.options.url);
    url.search = '';
    url.searchParams.set('p', encodePuzzle(puzzle));
    url.searchParams.set('d', this.difficulty);
    this.options.url = url;
    this.options.onUrlChange?.(url);
  }

  private update(change: (state: GameState) => GameState): void {
    if (this.state) this.setState(change(this.state));
  }

  private setState(next: GameState): void {
    const previous = this.state;
    if (next === previous) return;
    this.state = next;
    if (previous?.status === 'playing' && next.status === 'won')
      this.el['win-modal']!.hidden = false;
    this.render();
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    renderBoard(this.el['game-board']!, this.el['relationship-clues-container']!, state);
    renderSpawners(this.el['spawner-grid']!, this.el['spawner-clues-container']!, state);
    renderSpawnerNotes(this.el['spawner-notes-grid']!, state);
    const playing = state.status === 'playing';
    for (const id of ['reset-btn', 'clue-btn', 'reveal-btn', 'checkpoint-btn']) {
      this.el[id]!.hidden = !playing;
    }
    this.el['restore-btn']!.hidden = !playing || !state.checkpoint;
    (this.el['clue-btn'] as HTMLButtonElement).disabled = !canHint(state);
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
    this.el['status']!.textContent = text;
  }

  private on(id: string, type: string, handler: () => void): void {
    this.el[id]!.addEventListener(type, handler);
  }
}
