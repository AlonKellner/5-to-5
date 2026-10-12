const SVG_NS = 'http://www.w3.org/2000/svg';

interface Shape {
  tag: 'path' | 'circle' | 'line' | 'rect';
  attrs: Record<string, string | number>;
}

const path = (d: string): Shape => ({ tag: 'path', attrs: { d } });
const circle = (cx: number, cy: number, r: number): Shape => ({
  tag: 'circle',
  attrs: { cx, cy, r },
});
const dot = (cx: number, cy: number): Shape => ({
  tag: 'circle',
  attrs: { cx, cy, r: 1.1, fill: 'currentColor', stroke: 'none' },
});
const line = (x1: number, y1: number, x2: number, y2: number): Shape => ({
  tag: 'line',
  attrs: { x1, y1, x2, y2 },
});
const rect = (x: number, y: number, width: number, height: number, rx: number): Shape => ({
  tag: 'rect',
  attrs: { x, y, width, height, rx },
});

/** Outline icon in a 24×24 box, sized and colored from CSS (like lockIcon in dom.ts). */
function strokeIcon(...shapes: Shape[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'btn-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const shape of shapes) {
    const node = document.createElementNS(SVG_NS, shape.tag);
    for (const [name, value] of Object.entries(shape.attrs)) {
      node.setAttribute(name, String(value));
    }
    svg.appendChild(node);
  }
  return svg;
}

export interface ButtonIcon {
  icon: () => SVGSVGElement;
  label: string;
  /** Tooltip, when it should say more than the label. */
  title?: string;
  /** Buttons near the bottom of the page open their tooltip upwards. */
  tooltipPosition?: 'above';
}

/** One entry per toolbar button; the key is the button's element id. */
export const BUTTON_ICONS: Record<string, ButtonIcon> = {
  'new-btn': {
    label: 'New puzzle',
    icon: () =>
      strokeIcon(
        rect(3, 3, 18, 18, 3),
        dot(8, 8),
        dot(16, 8),
        dot(12, 12),
        dot(8, 16),
        dot(16, 16),
      ),
  },
  'reset-btn': {
    label: 'Reset',
    title: 'Reset to the clues',
    icon: () => strokeIcon(path('M3 12a9 9 0 1 0 3-6.7'), path('M3 4v5h5')),
  },
  'clue-btn': {
    label: 'Reveal a clue',
    icon: () =>
      strokeIcon(
        path('M9 18h6'),
        path('M10 21h4'),
        path('M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2 1 1.9h5.2c.1-.7.4-1.4 1-1.9A6 6 0 0 0 12 3z'),
      ),
  },
  'reveal-btn': {
    label: 'Show the solution',
    icon: () =>
      strokeIcon(path('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'), circle(12, 12, 3)),
  },
  'undo-btn': {
    label: 'Undo',
    title: 'Undo (Ctrl+Z / ⌘Z)',
    icon: () => strokeIcon(path('M9 14 4 9l5-5'), path('M4 9h10a6 6 0 0 1 0 12h-3')),
  },
  'check-btn': {
    label: 'Check for mistakes',
    icon: () => strokeIcon(circle(11, 11, 7), line(16, 16, 21, 21)),
  },
  'checkpoint-btn': {
    label: 'Save a checkpoint',
    icon: () => strokeIcon(path('M5 21V4h14l-3 4 3 4H5')),
  },
  'restore-btn': {
    label: 'Restore the checkpoint',
    icon: () =>
      strokeIcon(path('M5 21V4h14l-3 4 3 4H5'), path('M9 17a4 4 0 1 0-1.3-3'), path('M6 11v3h3')),
  },
  'share-btn': {
    label: 'Copy a link to this puzzle',
    tooltipPosition: 'above',
    icon: () =>
      strokeIcon(
        path('M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1'),
        path('M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'),
      ),
  },
  'help-btn': {
    label: 'Help',
    title: 'Rules and tutorial',
    icon: () =>
      strokeIcon(
        circle(12, 12, 9),
        path('M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 4'),
        dot(12, 17.5),
      ),
  },
};

/**
 * Replaces the text of every known button under `root` with its icon, an accessible name and a
 * tooltip (rendered by CSS from data-tooltip).
 */
export function applyButtonIcons(root: ParentNode): void {
  for (const [id, entry] of Object.entries(BUTTON_ICONS)) {
    const button = root.querySelector<HTMLElement>(`#${id}`);
    if (!button) continue;
    button.replaceChildren(entry.icon());
    button.setAttribute('aria-label', entry.label);
    // Our tooltip shows instantly on hover and focus; a native title would add a second, slow one.
    button.removeAttribute('title');
    button.dataset['tooltip'] = entry.title ?? entry.label;
    if (entry.tooltipPosition) button.dataset['tooltipPosition'] = entry.tooltipPosition;
    else delete button.dataset['tooltipPosition'];
  }
}
