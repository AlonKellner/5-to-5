// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './modal';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

describe('Modal', () => {
  let modal: Modal;
  let onClose: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="opener">open</button>
      <div id="m" class="modal" hidden>
        <div class="modal-card"><button id="inside">Close</button></div>
      </div>`;
    onClose = vi.fn();
    modal = new Modal($('#m'), { onClose });
  });

  it('starts closed', () => {
    expect(modal.isOpen).toBe(false);
    expect($('#m').hidden).toBe(true);
  });

  it('opens and focuses the first control in the card', () => {
    modal.open();
    expect(modal.isOpen).toBe(true);
    expect($('#m').hidden).toBe(false);
    expect(document.activeElement).toBe($('#inside'));
  });

  it('closes when the scrim is clicked but not the card', () => {
    modal.open();
    $('.modal-card').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.isOpen).toBe(true);
    $('#m').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and then stops listening', () => {
    modal.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.isOpen).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    modal.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(modal.isOpen).toBe(true);
  });

  it('returns focus to whatever opened it', () => {
    $('#opener').focus();
    modal.open();
    modal.close();
    expect(document.activeElement).toBe($('#opener'));
  });

  it('can be closed twice and before it was ever opened', () => {
    expect(() => modal.close()).not.toThrow();
    modal.open();
    modal.close();
    modal.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
