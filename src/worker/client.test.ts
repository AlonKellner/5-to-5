import { describe, expect, it, vi } from 'vitest';
import { legacyPuzzle } from '../../test/fixtures/legacyPuzzle';
import { encodePuzzle } from '../core/codec';
import { formatBoard } from '../core/board';
import { GeneratorClient, type WorkerLike } from './client';
import type { GenerateRequest, GeneratorMessage } from './protocol';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<GeneratorMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: GenerateRequest[] = [];
  terminated = false;

  postMessage(request: GenerateRequest) {
    this.requests.push(request);
  }

  terminate() {
    this.terminated = true;
  }

  reply(message: GeneratorMessage) {
    this.onmessage?.({ data: message } as MessageEvent<GeneratorMessage>);
  }
}

const rating = {
  level: 5 as const,
  score: 480,
  stats: { steps: [5, 2, 3, 0, 4], guessNodes: 0, effort: 60, tileClues: 4, relationClues: 12 },
};

describe('GeneratorClient', () => {
  it('resolves with the decoded puzzle for the matching request', async () => {
    const workers: FakeWorker[] = [];
    const client = new GeneratorClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const promise = client.generate('abc', 5);
    const worker = workers[0]!;
    expect(worker.requests).toEqual([{ id: 1, seed: 'abc', difficulty: 5 }]);
    worker.reply({
      id: 1,
      type: 'result',
      code: encodePuzzle(legacyPuzzle()),
      seed: 'abc',
      rating,
    });
    const puzzle = await promise;
    expect(formatBoard(puzzle.solution)).toBe(formatBoard(legacyPuzzle().solution));
    expect(puzzle.rating).toEqual(rating);
    expect(puzzle.seed).toBe('abc');
  });

  it('forwards progress events', async () => {
    const worker = new FakeWorker();
    const client = new GeneratorClient(() => worker);
    const onProgress = vi.fn();
    const promise = client.generate('abc', 2, onProgress);
    worker.reply({ id: 1, type: 'progress', progress: { phase: 'board', attempt: 1, trials: 5 } });
    worker.reply({
      id: 1,
      type: 'result',
      code: encodePuzzle(legacyPuzzle()),
      seed: 'abc',
      rating,
    });
    await promise;
    expect(onProgress).toHaveBeenCalledWith({ phase: 'board', attempt: 1, trials: 5 });
  });

  it('rejects on worker errors', async () => {
    const worker = new FakeWorker();
    const client = new GeneratorClient(() => worker);
    const promise = client.generate('abc', 2);
    worker.reply({ id: 1, type: 'error', message: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('cancels a running request by replacing the worker', async () => {
    const workers: FakeWorker[] = [];
    const client = new GeneratorClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const first = client.generate('one', 6);
    const second = client.generate('two', 2);
    await expect(first).rejects.toThrow(/cancel/i);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.requests).toEqual([{ id: 2, seed: 'two', difficulty: 2 }]);
    workers[1]!.reply({
      id: 2,
      type: 'result',
      code: encodePuzzle(legacyPuzzle()),
      seed: 'two',
      rating,
    });
    await expect(second).resolves.toMatchObject({ seed: 'two' });
  });

  it('ignores messages from stale requests', async () => {
    const worker = new FakeWorker();
    const client = new GeneratorClient(() => worker);
    const promise = client.generate('abc', 2);
    worker.reply({ id: 99, type: 'error', message: 'stale' });
    worker.reply({
      id: 1,
      type: 'result',
      code: encodePuzzle(legacyPuzzle()),
      seed: 'abc',
      rating,
    });
    await expect(promise).resolves.toBeDefined();
  });
});
