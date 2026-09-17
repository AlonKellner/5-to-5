import { encodePuzzle } from '../core/codec';
import { generatePuzzle } from '../core/generator/generate';
import type { GenerateRequest, GeneratorMessage } from './protocol';

const post = (message: GeneratorMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, seed, difficulty } = event.data;
  try {
    const puzzle = generatePuzzle({
      seed,
      difficulty,
      onProgress: (progress) => post({ id, type: 'progress', progress }),
    });
    post({ id, type: 'result', code: encodePuzzle(puzzle), seed, rating: puzzle.rating! });
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
