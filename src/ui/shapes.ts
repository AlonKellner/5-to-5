const SVG_NS = 'http://www.w3.org/2000/svg';

/** One shape per color, in color order, so colors can be told apart without seeing them. */
export const COLOR_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon'] as const;

type Point = readonly [number, number];

/**
 * A regular polygon around the middle of the 100×100 box. Its vertices average to its center of
 * mass, so every shape sits on the same point as the circle, however many corners it has.
 */
function regularPolygon(corners: number, radius: number, firstAngle: number): Point[] {
  return Array.from({ length: corners }, (_, i) => {
    const angle = ((firstAngle + (360 * i) / corners) * Math.PI) / 180;
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return [round(50 + radius * Math.cos(angle)), round(50 + radius * Math.sin(angle))] as const;
  });
}

/** Polygon corners in the 100×100 box, sized so the shapes look about equally large. */
export const SHAPE_POLYGONS = {
  // A 76-wide square.
  square: regularPolygon(4, 38 * Math.SQRT2, 45),
  // An equilateral triangle with 100-long sides, pointing up. Centred on its center of mass, its
  // tip pokes slightly above the box, which the stylesheet lets show.
  triangle: regularPolygon(3, 100 / Math.sqrt(3), -90),
  diamond: regularPolygon(4, 48, -90),
  pentagon: regularPolygon(5, 48, -90),
} satisfies Partial<Record<(typeof COLOR_SHAPES)[number], Point[]>>;

const polygonPath = (points: readonly Point[]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join('L')}z`;

const OUTLINES: Record<(typeof COLOR_SHAPES)[number], string> = {
  circle: 'M6 50a44 44 0 1 0 88 0a44 44 0 1 0 -88 0z',
  square: polygonPath(SHAPE_POLYGONS.square),
  triangle: polygonPath(SHAPE_POLYGONS.triangle),
  diamond: polygonPath(SHAPE_POLYGONS.diamond),
  pentagon: polygonPath(SHAPE_POLYGONS.pentagon),
};

/** A darkened shape drawn on top of a colored surface; its size comes from the stylesheet. */
export function colorShape(color: number): SVGSVGElement {
  const name = COLOR_SHAPES[color]!;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'color-shape');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset['shape'] = name;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', OUTLINES[name]);
  svg.appendChild(path);
  return svg;
}
