const SVG_NS = 'http://www.w3.org/2000/svg';

/** One shape per color, in color order, so colors can be told apart without seeing them. */
export const COLOR_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon'] as const;

/** Outlines in a 100×100 box, each filling about the same area. */
const OUTLINES: Record<(typeof COLOR_SHAPES)[number], string> = {
  circle: 'M6 50a44 44 0 1 0 88 0a44 44 0 1 0 -88 0z',
  square: 'M12 12h76v76h-76z',
  triangle: 'M50 4L97 90H3z',
  diamond: 'M50 2L98 50L50 98L2 50z',
  pentagon: 'M50 4L96 37.5L78.5 92H21.5L4 37.5z',
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
