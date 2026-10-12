// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { COLOR_COUNT } from '../core/constants';
import { COLOR_SHAPES, colorShape } from './shapes';

describe('colorShape', () => {
  it('gives each color its own shape', () => {
    expect(COLOR_SHAPES).toEqual(['circle', 'square', 'triangle', 'diamond', 'pentagon']);
    expect(COLOR_SHAPES).toHaveLength(COLOR_COUNT);
    const outlines = COLOR_SHAPES.map((_, color) => colorShape(color).innerHTML);
    expect(new Set(outlines).size).toBe(COLOR_COUNT);
  });

  it('builds a decorative, CSS-sized svg', () => {
    const shape = colorShape(2);
    expect(shape.tagName).toBe('svg');
    expect(shape.getAttribute('class')).toBe('color-shape');
    expect(shape.dataset['shape']).toBe('triangle');
    expect(shape.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(shape.getAttribute('aria-hidden')).toBe('true');
    expect(shape.getAttribute('width')).toBeNull();
  });
});
