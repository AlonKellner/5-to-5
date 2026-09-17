export interface ElementProps {
  className?: string;
  text?: string;
  dataset?: Record<string, string | number>;
  attrs?: Record<string, string>;
  style?: Partial<Record<string, string>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: (Node | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [key, value] of Object.entries(props.dataset ?? {})) node.dataset[key] = String(value);
  for (const [key, value] of Object.entries(props.attrs ?? {})) node.setAttribute(key, value);
  for (const [key, value] of Object.entries(props.style ?? {})) {
    if (value !== undefined) node.style.setProperty(key, value);
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  const node = root.querySelector<T>(`#${id}`);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function lockIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'lock-icon');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'white');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('clip-rule', 'evenodd');
  path.setAttribute(
    'd',
    'M10 1a3 3 0 00-3 3v1H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a3 3 0 00-3-3zM8 5V4a2 2 0 114 0v1H8zm-1 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z',
  );
  svg.appendChild(path);
  return svg;
}
