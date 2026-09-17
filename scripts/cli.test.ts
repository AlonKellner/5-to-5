import { describe, expect, it } from 'vitest';
import { decodePuzzle } from '../src/core/codec';
import { runCli } from './cli';

describe('puzzle CLI', () => {
  it('prints an ASCII puzzle for a seed', () => {
    const text = runCli(['--seed', 'cli', '--difficulty', 'easy']);
    expect(text).toContain('seed cli · easy');
    expect(text.split('\n').filter((l) => /^[.rbgyp] /.test(l))).toHaveLength(5);
  });

  it('prints the solution and rules on request', () => {
    const text = runCli(['--seed', 'cli', '--difficulty', 'easy', '--solution']);
    expect(text).toMatch(/r: must [rbgyp], never [rbgyp]/);
  });

  it('emits decodable JSON', () => {
    const parsed = JSON.parse(runCli(['--seed', 'cli', '--difficulty', 'medium', '--json']));
    expect(parsed).toMatchObject({ seed: 'cli', difficulty: 'medium' });
    expect(() => decodePuzzle(parsed.code)).not.toThrow();
  });

  it('rejects unknown difficulties', () => {
    expect(() => runCli(['--difficulty', 'impossible'])).toThrow(/difficulty/);
  });
});
