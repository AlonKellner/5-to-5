// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tutorial, type TutorialOutcome } from './tutorial';
import type { TutorialStep } from './tutorialSteps';

const STEPS: TutorialStep[] = [
  { id: 'one', title: 'First', body: 'The board itself.', target: '#board' },
  { id: 'two', title: 'Second', body: 'The bins beside it.', target: '#bins' },
  { id: 'three', title: 'Third', body: 'The controls below.', target: '#controls' },
];

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const bubbleTitle = () => $('.tutorial-title').textContent;

function stubRect(selector: string, rect: Partial<DOMRect>) {
  $(selector).getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, ...rect }) as DOMRect;
}

describe('Tutorial', () => {
  let tutorial: Tutorial;
  let onFinish: (outcome: TutorialOutcome) => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app"><div id="board"></div><div id="bins"></div><div id="controls"></div></div>`;
    onFinish = vi.fn();
    tutorial = new Tutorial({ root: $('#app'), steps: STEPS, onFinish });
  });

  it('shows the first step with its progress', () => {
    tutorial.start();
    expect(tutorial.isRunning).toBe(true);
    expect($('.tutorial')).not.toBeNull();
    expect(bubbleTitle()).toBe('First');
    expect($('.tutorial-body').textContent).toBe('The board itself.');
    expect($('.tutorial-progress').textContent).toBe('1 / 3');
  });

  it('puts the spotlight over the target', () => {
    stubRect('#board', { left: 40, top: 60, width: 100, height: 120 });
    tutorial.start();
    const spotlight = $('.tutorial-spotlight');
    expect(spotlight.style.left).toBe('40px');
    expect(spotlight.style.top).toBe('60px');
    expect(spotlight.style.width).toBe('100px');
    expect(spotlight.style.height).toBe('120px');
  });

  it('puts the bubble just below the target', () => {
    stubRect('#board', { left: 40, top: 50, width: 100, height: 100, right: 140, bottom: 150 });
    tutorial.start();
    expect($('.tutorial-bubble').style.left).toBe('40px');
    expect($('.tutorial-bubble').style.top).toBe('162px');
  });

  it('keeps the bubble inside the viewport', () => {
    stubRect('#board', { left: -50, top: 0, width: 20, height: 20, right: -30, bottom: 20 });
    tutorial.start();
    expect($('.tutorial-bubble').style.left).toBe('10px');
  });

  it('moves to the next step', () => {
    tutorial.start();
    $('#tutorial-next-btn').click();
    expect(bubbleTitle()).toBe('Second');
    expect($('.tutorial-progress').textContent).toBe('2 / 3');
  });

  it('finishes from the last step', () => {
    tutorial.start();
    $('#tutorial-next-btn').click();
    $('#tutorial-next-btn').click();
    expect($('#tutorial-next-btn').textContent).toBe('Done');
    $('#tutorial-next-btn').click();
    expect(document.querySelector('.tutorial')).toBeNull();
    expect(tutorial.isRunning).toBe(false);
    expect(onFinish).toHaveBeenCalledWith('done');
  });

  it('can be skipped', () => {
    tutorial.start();
    $('#tutorial-skip-btn').click();
    expect(document.querySelector('.tutorial')).toBeNull();
    expect(onFinish).toHaveBeenCalledWith('skipped');
  });

  it('skips on Escape and advances on the arrow and enter keys', () => {
    tutorial.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(bubbleTitle()).toBe('Second');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(bubbleTitle()).toBe('Third');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onFinish).toHaveBeenCalledWith('skipped');
  });

  it('skips steps whose element is not on the page', () => {
    $('#bins').remove();
    tutorial.start();
    $('#tutorial-next-btn').click();
    expect(bubbleTitle()).toBe('Third');
  });

  it('finishes immediately when nothing can be shown', () => {
    document.body.innerHTML = '<div id="app"></div>';
    new Tutorial({ root: $('#app'), steps: STEPS, onFinish }).start();
    expect(document.querySelector('.tutorial')).toBeNull();
    expect(onFinish).toHaveBeenCalledWith('done');
  });

  it('blocks the page while it runs', () => {
    tutorial.start();
    expect($('.tutorial-blocker')).not.toBeNull();
  });

  it('can be stopped twice, silently, and then ignores keys', () => {
    tutorial.start();
    tutorial.stop();
    tutorial.stop();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(document.querySelector('.tutorial')).toBeNull();
  });

  it('repositions the spotlight on demand', () => {
    stubRect('#board', { left: 10, top: 10, width: 20, height: 20 });
    tutorial.start();
    stubRect('#board', { left: 50, top: 70, width: 30, height: 40 });
    tutorial.reposition();
    expect($('.tutorial-spotlight').style.left).toBe('50px');
    expect($('.tutorial-spotlight').style.top).toBe('70px');
  });

  it('announces each step and focuses the next button', () => {
    tutorial.start();
    expect($('.tutorial-bubble').getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe($('#tutorial-next-btn'));
  });
});
