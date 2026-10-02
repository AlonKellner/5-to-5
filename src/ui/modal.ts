export interface ModalOptions {
  onClose?: () => void;
}

/**
 * A dialog that is pre-rendered hidden in the page skeleton. It closes on its own buttons, on a
 * click outside the card and on Escape; its listeners only exist while it is open.
 */
export class Modal {
  private opener: Element | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly options: ModalOptions = {},
  ) {}

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    if (this.isOpen) return;
    const doc = this.el.ownerDocument;
    this.opener = doc.activeElement;
    this.el.hidden = false;
    this.el.addEventListener('click', this.onBackdropClick);
    doc.addEventListener('keydown', this.onKeyDown);
    const card = this.el.querySelector<HTMLElement>('.modal-card');
    if (card) card.scrollTop = 0;
    const target =
      this.el.querySelector<HTMLElement>('.modal-card [autofocus]') ??
      (card?.hasAttribute('tabindex') ? card : null) ??
      this.el.querySelector<HTMLElement>('.modal-card button');
    target?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    const doc = this.el.ownerDocument;
    this.el.hidden = true;
    this.el.removeEventListener('click', this.onBackdropClick);
    doc.removeEventListener('keydown', this.onKeyDown);
    (this.opener as HTMLElement | null)?.focus?.();
    this.opener = null;
    this.options.onClose?.();
  }

  private readonly onBackdropClick = (event: MouseEvent) => {
    if (!(event.target as Element).closest('.modal-card')) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  };
}
