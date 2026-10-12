import { COLOR_COUNT, COLOR_NAMES } from '../core/constants';
import { noteHalves, type NoteHalf } from '../game/state';
import { el } from './dom';
import { colorShape } from './shapes';

export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 10,
): { left: number; top: number } {
  let left = x;
  let top = y;
  if (left + width > viewportWidth) left = viewportWidth - width - margin;
  if (top + height > viewportHeight) top = viewportHeight - height - margin;
  return { left: Math.max(margin, left), top: Math.max(margin, top) };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A square outline with one half filled in: the half that the color buttons write to. */
function halfIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'half-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const highlight = document.createElementNS(SVG_NS, 'rect');
  highlight.setAttribute('class', 'half-highlight');
  highlight.setAttribute('x', '4');
  highlight.setAttribute('width', '16');
  highlight.setAttribute('height', '8');
  const outline = document.createElementNS(SVG_NS, 'rect');
  outline.setAttribute('class', 'half-outline');
  for (const [name, value] of Object.entries({ x: 4, y: 4, width: 16, height: 16, rx: 2 })) {
    outline.setAttribute(name, String(value));
  }
  svg.append(highlight, outline);
  return svg;
}

/**
 * Popup for toggling note colors; closes on any press outside it. Every note square has a top and
 * a bottom half; the sixth button switches which half the color buttons write to.
 */
export class NotesMenu {
  private menu: HTMLElement | null = null;

  constructor(private readonly doc: Document) {}

  get isOpen(): boolean {
    return this.menu !== null;
  }

  /**
   * `mask` holds both halves' colors (see noteHalves); `onToggle` receives a color and a half and
   * returns the whole note mask after toggling it. The menu always starts on the top half.
   */
  open(
    point: { x: number; y: number },
    mask: number,
    onToggle: (color: number, half: NoteHalf) => number,
  ): void {
    this.close();
    let half: NoteHalf = 'top';
    let current = mask;
    const menu = el('div', { className: 'note-menu', attrs: { role: 'menu' } });
    const options = Array.from({ length: COLOR_COUNT }, (_, color) => {
      const option = el(
        'button',
        {
          className: `note-option color-${color}`,
          dataset: { color },
          attrs: { 'aria-label': COLOR_NAMES[color]!, role: 'menuitemcheckbox' },
        },
        [colorShape(color)],
      );
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        current = onToggle(color, half);
        refresh();
      });
      return option;
    });
    const toggle = el('button', { className: 'note-half-toggle', attrs: { role: 'menuitem' } }, [
      halfIcon(),
    ]);
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      half = half === 'top' ? 'bottom' : 'top';
      refresh();
    });
    const refresh = () => {
      const colors = noteHalves(current)[half];
      options.forEach((option, color) => {
        const on = (colors & (1 << color)) !== 0;
        option.classList.toggle('selected', on);
        option.setAttribute('aria-checked', String(on));
      });
      toggle.dataset['half'] = half;
      const other = half === 'top' ? 'bottom' : 'top';
      toggle.setAttribute('aria-label', `Writing in the ${half} half; switch to the ${other} half`);
    };
    refresh();
    menu.append(...options, toggle);
    this.doc.body.appendChild(menu);
    const view = this.doc.defaultView;
    const rect = menu.getBoundingClientRect();
    const { left, top } = clampMenuPosition(
      point.x,
      point.y,
      rect.width,
      rect.height,
      view?.innerWidth ?? Infinity,
      view?.innerHeight ?? Infinity,
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    this.menu = menu;
    this.doc.addEventListener('pointerdown', this.onOutsidePress, true);
  }

  close(): void {
    this.menu?.remove();
    this.menu = null;
    this.doc.removeEventListener('pointerdown', this.onOutsidePress, true);
  }

  private readonly onOutsidePress = (event: Event) => {
    const target = event.target as Element | null;
    if (this.menu && target && !this.menu.contains(target)) this.close();
  };
}
