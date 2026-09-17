import { decodePuzzle } from '../core/codec';
import type { GenerateProgress } from '../core/generator/generate';
import type { DifficultyLevel, Puzzle } from '../core/puzzle';
import type { GenerateRequest, GeneratorMessage } from './protocol';

export interface WorkerLike {
  onmessage: ((event: MessageEvent<GeneratorMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: GenerateRequest): void;
  terminate(): void;
}

export interface PuzzleSource {
  generate(
    seed: string,
    difficulty: DifficultyLevel,
    onProgress?: (progress: GenerateProgress) => void,
  ): Promise<Puzzle>;
}

interface Pending {
  id: number;
  resolve: (puzzle: Puzzle) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: GenerateProgress) => void;
}

/** Runs puzzle generation in a Web Worker. One request at a time; a new request cancels the old. */
export class GeneratorClient implements PuzzleSource {
  private worker: WorkerLike | null = null;
  private pending: Pending | null = null;
  private nextId = 1;

  constructor(private readonly createWorker: () => WorkerLike) {}

  generate(
    seed: string,
    difficulty: DifficultyLevel,
    onProgress?: (progress: GenerateProgress) => void,
  ): Promise<Puzzle> {
    this.cancel();
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<Puzzle>((resolve, reject) => {
      this.pending = { id, resolve, reject, onProgress };
      worker.postMessage({ id, seed, difficulty });
    });
  }

  cancel(): void {
    if (!this.pending) return;
    this.pending.reject(new Error('Generation cancelled'));
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => this.handle(event.data);
    worker.onerror = (event) => this.fail(new Error(event.message || 'Generator worker failed'));
    this.worker = worker;
    return worker;
  }

  private handle(message: GeneratorMessage): void {
    const pending = this.pending;
    if (!pending || message.id !== pending.id) return;
    if (message.type === 'progress') {
      pending.onProgress?.(message.progress);
      return;
    }
    this.pending = null;
    if (message.type === 'error') {
      pending.reject(new Error(message.message));
      return;
    }
    try {
      pending.resolve({
        ...decodePuzzle(message.code),
        seed: message.seed,
        rating: message.rating,
      });
    } catch (error) {
      pending.reject(error as Error);
    }
  }

  private fail(error: Error): void {
    const pending = this.pending;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    pending?.reject(error);
  }
}
