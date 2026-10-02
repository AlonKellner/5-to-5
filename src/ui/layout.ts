import { DIFFICULTY_LEVELS, DIFFICULTY_NAMES } from '../core/puzzle';
import { applyButtonIcons } from './icons';

/** Static page skeleton; everything inside the ids is rendered from state. */
export function mountLayout(root: HTMLElement): void {
  const options = DIFFICULTY_LEVELS.map(
    (level) => `<option value="${level}">${level} · ${DIFFICULTY_NAMES[level]}</option>`,
  ).join('');
  root.innerHTML = `
    <main class="container">
      <header class="header">
        <h1>5-to-5</h1>
        <p class="subtitle">Place five tiles of each color. Every color must always touch one
          color and never touches another — find out which.</p>
      </header>

      <div id="top-controls" class="toolbar">
        <select id="difficulty-select" class="select" aria-label="Difficulty">${options}</select>
        <button id="new-btn" class="btn btn-green">New puzzle</button>
        <button id="reset-btn" class="btn btn-yellow">Reset</button>
        <button id="clue-btn" class="btn btn-cyan">Clue</button>
        <button id="reveal-btn" class="btn btn-indigo">Solve</button>
        <button id="help-btn" class="btn btn-gray">Help</button>
      </div>

      <div id="status" class="status" aria-live="polite"></div>

      <div class="play-area">
        <div id="board-panel" class="panel board-panel">
          <div id="game-board" class="grid5"></div>
          <div id="relationship-clues-container" class="overlay grid5"></div>
        </div>

        <div id="bottom-controls" class="toolbar">
          <button id="undo-btn" class="btn btn-gray" disabled>Undo</button>
          <button id="check-btn" class="btn btn-teal">Check</button>
          <button id="checkpoint-btn" class="btn btn-purple">Checkpoint</button>
          <button id="restore-btn" class="btn btn-pink" hidden>Restore</button>
        </div>

        <div id="tray-panel" class="panel tray-panel">
          <div id="spawner-grid" class="grid5"></div>
          <div id="spawner-clues-container" class="overlay grid5"></div>
        </div>

        <div id="notes-panel" class="panel notes-panel">
          <div id="spawner-notes-grid" class="grid5"></div>
        </div>

        <footer class="footer">
          <span id="puzzle-info"></span>
          <button id="share-btn" class="btn btn-gray">Copy link</button>
        </footer>
      </div>
    </main>

    <div
      id="help-modal"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      hidden
    >
      <div class="modal-card modal-card-help" tabindex="-1">
        <h2 id="help-title">How to play</h2>
        <div id="help-body" class="help-body"></div>
        <div class="modal-actions">
          <button id="start-tutorial-btn" class="btn btn-green">Show me around</button>
          <button id="close-help-btn" class="btn btn-gray">Close</button>
        </div>
      </div>
    </div>

    <div id="win-modal" class="modal" role="dialog" aria-modal="true" hidden>
      <div class="modal-card">
        <h2>You Win!</h2>
        <p>Congratulations, you solved the puzzle!</p>
        <button id="close-win-modal-btn" class="btn btn-gray">Close</button>
      </div>
    </div>
  `;
  applyButtonIcons(root);
}
