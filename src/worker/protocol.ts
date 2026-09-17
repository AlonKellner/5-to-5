import type { GenerateProgress } from '../core/generator/generate';
import type { DifficultyLevel, Rating } from '../core/puzzle';

export interface GenerateRequest {
  id: number;
  seed: string;
  difficulty: DifficultyLevel;
}

export type GeneratorMessage =
  | { id: number; type: 'progress'; progress: GenerateProgress }
  | { id: number; type: 'result'; code: string; seed: string; rating: Rating }
  | { id: number; type: 'error'; message: string };
