import { describe, expect, it } from 'vitest';
import { decodePuzzle } from '../src/core/codec';
import { runCli } from './cli';

describe('puzzle CLI', () => {
  it('prints an ASCII puzzle for a seed', () => {
    const text = runCli(['--seed', 'cli', '--difficulty', '2']);
    expect(text).toContain('seed cli · level 2 Easy');
    expect(text.split('\n').filter((l) => /^[.rbgyp] /.test(l))).toHaveLength(5);
  });

  it('prints the solution and rules on request', () => {
    const text = runCli(['--seed', 'cli', '--difficulty', 'beginner', '--solution']);
    expect(text).toMatch(/r: must [rbgyp], never [rbgyp]/);
  });

  it('emits decodable JSON', () => {
    const parsed = JSON.parse(runCli(['--seed', 'cli', '--difficulty', '3', '--json']));
    expect(parsed).toMatchObject({ seed: 'cli', difficulty: 3 });
    expect(() => decodePuzzle(parsed.code)).not.toThrow();
  });

  it('rejects unknown difficulties', () => {
    expect(() => runCli(['--difficulty', 'impossible'])).toThrow(/difficulty/);
  });
});
