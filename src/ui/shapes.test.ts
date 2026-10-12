// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { COLOR_COUNT } from '../core/constants';
import { COLOR_SHAPES, colorShape, SHAPE_POLYGONS } from './shapes';

describe('colorShape', () => {
  it('gives each color its own shape', () => {
    expect(COLOR_SHAPES).toEqual(['circle', 'square', 'trapezoid', 'diamond', 'pentagon']);
    expect(COLOR_SHAPES).toHaveLength(COLOR_COUNT);
    const outlines = COLOR_SHAPES.map((_, color) => colorShape(color).innerHTML);
    expect(new Set(outlines).size).toBe(COLOR_COUNT);
  });

  it('builds a decorative, CSS-sized svg', () => {
    const shape = colorShape(2);
    expect(shape.tagName).toBe('svg');
    expect(shape.getAttribute('class')).toBe('color-shape');
    expect(shape.dataset['shape']).toBe('trapezoid');
    expect(shape.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(shape.getAttribute('aria-hidden')).toBe('true');
    expect(shape.getAttribute('width')).toBeNull();
  });

  it('centers every polygon on its center of mass', () => {
    for (const [name, points] of Object.entries(SHAPE_POLYGONS)) {
      // Area-weighted centroid of a simple polygon (shoelace formula).
      let area = 0;
      let cx = 0;
      let cy = 0;
      points.forEach(([x0, y0], i) => {
        const [x1, y1] = points[(i + 1) % points.length]!;
        const cross = x0 * y1 - x1 * y0;
        area += cross / 2;
        cx += ((x0 + x1) * cross) / 6;
        cy += ((y0 + y1) * cross) / 6;
      });
      expect(cx / area, name).toBeCloseTo(50, 1);
      expect(cy / area, name).toBeCloseTo(50, 1);
    }
  });

  it('draws a regular pentagon', () => {
    const points = SHAPE_POLYGONS.pentagon;
    const lengths = points.map(([x0, y0], i) => {
      const [x1, y1] = points[(i + 1) % points.length]!;
      return Math.hypot(x1 - x0, y1 - y0);
    });
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0]!, 1);
  });

  it('draws a symmetric trapezoid, wider at the bottom, inside the box', () => {
    const [topLeft, topRight, bottomRight, bottomLeft] = SHAPE_POLYGONS.trapezoid;
    expect(topLeft![1]).toBeCloseTo(topRight![1]);
    expect(bottomLeft![1]).toBeCloseTo(bottomRight![1]);
    expect(50 - topLeft![0]).toBeCloseTo(topRight![0] - 50);
    expect(50 - bottomLeft![0]).toBeCloseTo(bottomRight![0] - 50);
    expect(bottomRight![0] - bottomLeft![0]).toBeGreaterThan(topRight![0] - topLeft![0]);
    for (const [x, y] of SHAPE_POLYGONS.trapezoid) {
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
      expect(Math.max(x, y)).toBeLessThanOrEqual(100);
    }
  });
});
