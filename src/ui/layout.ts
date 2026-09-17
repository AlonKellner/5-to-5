import { DIFFICULTY_LEVELS } from '../core/puzzle';

/** Static page skeleton; everything inside the ids is rendered from state. */
export function mountLayout(root: HTMLElement): void {
  const options = DIFFICULTY_LEVELS.map(
    (level) => `<option value="${level}">${level[0]!.toUpperCase()}${level.slice(1)}</option>`,
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
      </div>

      <div id="status" class="status" aria-live="polite"></div>

      <div class="play-area">
        <section class="board-column">
          <div class="panel">
            <div id="game-board" class="grid5"></div>
            <div id="relationship-clues-container" class="overlay grid5 rows5"></div>
          </div>

          <div id="bottom-controls" class="toolbar">
            <button id="checkpoint-btn" class="btn btn-purple">Checkpoint</button>
            <button id="restore-btn" class="btn btn-pink" hidden>Restore</button>
          </div>
        </section>

        <section class="tray-column">
          <div class="panel">
            <div id="spawner-grid" class="grid5"></div>
            <div id="spawner-clues-container" class="overlay grid5 rows1"></div>
          </div>

          <div class="panel">
            <div id="spawner-notes-grid" class="grid5"></div>
          </div>

          <footer class="footer">
            <span id="puzzle-info"></span>
            <button id="share-btn" class="btn btn-gray">Copy link</button>
          </footer>
        </section>
      </div>
    </main>

    <div id="win-modal" class="modal" role="dialog" aria-modal="true" hidden>
      <div class="modal-card">
        <h2>You Win!</h2>
        <p>Congratulations, you solved the puzzle!</p>
        <button id="close-win-modal-btn" class="btn btn-gray">Close</button>
      </div>
    </div>
  `;
}
