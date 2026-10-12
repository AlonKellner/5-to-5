import { placeBubble } from './bubblePosition';
import { el } from './dom';
import { TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps';

export type TutorialOutcome = 'done' | 'skipped';

export interface TutorialOptions {
  /** Where the step targets are looked up. */
  root: HTMLElement;
  steps?: readonly TutorialStep[];
  onFinish?: (outcome: TutorialOutcome) => void;
}

/**
 * A guided tour: it dims the page, spotlights one element at a time and explains it. The player
 * only presses Next or Skip; a blocker swallows everything else, so no step can be broken by a
 * stray move.
 */
export class Tutorial {
  private overlay: HTMLElement | null = null;
  private spotlight: HTMLElement | null = null;
  private bubble: HTMLElement | null = null;
  private nextButton: HTMLButtonElement | null = null;
  private steps: TutorialStep[] = [];
  private index = 0;

  constructor(private readonly options: TutorialOptions) {}

  get isRunning(): boolean {
    return this.overlay !== null;
  }

  /** Index of the step on screen, for tests and debugging. */
  get step(): number {
    return this.index;
  }

  start(): void {
    if (this.isRunning) return;
    const all = this.options.steps ?? TUTORIAL_STEPS;
    this.steps = all.filter((step) => this.target(step) !== null);
    if (this.steps.length === 0) {
      this.options.onFinish?.('done');
      return;
    }
    this.index = 0;
    this.build();
    this.show();
    const doc = this.options.root.ownerDocument;
    doc.addEventListener('keydown', this.onKeyDown);
    doc.defaultView?.addEventListener('resize', this.reposition);
    doc.defaultView?.addEventListener('orientationchange', this.reposition);
  }

  stop(): void {
    if (!this.isRunning) return;
    const doc = this.options.root.ownerDocument;
    doc.removeEventListener('keydown', this.onKeyDown);
    doc.defaultView?.removeEventListener('resize', this.reposition);
    doc.defaultView?.removeEventListener('orientationchange', this.reposition);
    this.overlay?.remove();
    this.overlay = null;
    this.spotlight = null;
    this.bubble = null;
    this.nextButton = null;
  }

  /** Re-measures the current target, after a resize or a rotation. */
  readonly reposition = (): void => {
    if (!this.isRunning) return;
    const step = this.steps[this.index];
    const target = step ? this.target(step) : null;
    if (!target || !this.spotlight || !this.bubble) return;
    const rect = target.getBoundingClientRect();
    Object.assign(this.spotlight.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const view = this.options.root.ownerDocument.defaultView;
    const bubbleRect = this.bubble.getBoundingClientRect();
    const { left, top } = placeBubble(rect, bubbleRect, {
      width: view?.innerWidth ?? 0,
      height: view?.innerHeight ?? 0,
    });
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
  };

  private target(step: TutorialStep): HTMLElement | null {
    return this.options.root.querySelector<HTMLElement>(step.target);
  }

  private build(): void {
    this.spotlight = el('div', { className: 'tutorial-spotlight' });
    this.nextButton = el('button', {
      className: 'btn btn-green',
      attrs: { id: 'tutorial-next-btn', type: 'button' },
    });
    this.nextButton.addEventListener('click', () => this.next());
    const skip = el('button', {
      className: 'btn btn-gray',
      text: 'Skip',
      attrs: { id: 'tutorial-skip-btn', type: 'button' },
    });
    skip.addEventListener('click', () => this.finish('skipped'));
    this.bubble = el('div', { className: 'tutorial-bubble', attrs: { 'aria-live': 'polite' } }, [
      el('h3', { className: 'tutorial-title', attrs: { id: 'tutorial-title' } }),
      el('p', { className: 'tutorial-body' }),
      el('div', { className: 'tutorial-actions' }, [
        el('span', { className: 'tutorial-progress' }),
        skip,
        this.nextButton,
      ]),
    ]);
    this.overlay = el(
      'div',
      {
        className: 'tutorial',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tutorial-title' },
      },
      [el('div', { className: 'tutorial-blocker' }), this.spotlight, this.bubble],
    );
    this.options.root.ownerDocument.body.appendChild(this.overlay);
  }

  private show(): void {
    const step = this.steps[this.index]!;
    this.bubble!.querySelector('.tutorial-title')!.textContent = step.title;
    this.bubble!.querySelector('.tutorial-body')!.textContent = step.body;
    this.bubble!.querySelector('.tutorial-progress')!.textContent =
      `${this.index + 1} / ${this.steps.length}`;
    this.nextButton!.textContent = this.index === this.steps.length - 1 ? 'Done' : 'Next';
    this.reposition();
    this.nextButton!.focus({ preventScroll: true });
  }

  private next(): void {
    if (this.index >= this.steps.length - 1) {
      this.finish('done');
      return;
    }
    this.index++;
    this.show();
  }

  private finish(outcome: TutorialOutcome): void {
    this.stop();
    this.options.onFinish?.(outcome);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finish('skipped');
    } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.next();
    }
  };
}
