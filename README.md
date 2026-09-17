# 5-to-5

A deduction puzzle: place 5 tiles of each of 5 colors on a 5×5 board. Every color follows two
hidden rules, and you have to work them out from the clues.

**Play:** https://alonkellner.com/5-to-5/

## Rules

- Each color has one **must** neighbor: a color that is next to (up, down, left or right of) every
  tile of that color. It may be the color itself.
- Each color has one **never** neighbor: a color that is next to no tile of that color.
- These are the only such colors: no other color touches every tile of a color, and no other color
  is missing from all of them.
- The rules are mutual: if red must touch blue, blue must touch red; the same holds for never.

Clues are locked tiles and symbols between two neighboring cells, read left to right or top to
bottom along the color cycle red › blue › green › yellow › purple › red:

| symbol | meaning                        |
| ------ | ------------------------------ |
| `=`    | same color                     |
| `›`    | next color in the cycle        |
| `»`    | two steps forward              |
| `«`    | two steps back (three forward) |
| `‹`    | previous color in the cycle    |

Every generated puzzle has exactly one solution.

## Development

Requirements: Node 22 (see `.node-version`). On macOS:

```sh
brew install fnm
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc   # then open a new terminal
fnm install
npm install
npx playwright install chromium webkit   # only for end-to-end tests
```

| command                                          | what it does                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `npm run dev`                                    | dev server with hot reload at http://localhost:5173/5-to-5/      |
| `npm test` / `npm run test:watch`                | unit and DOM tests (Vitest)                                      |
| `npm run test:e2e`                               | browser tests (Playwright, desktop Chromium + iPhone WebKit)     |
| `npm run coverage`                               | unit tests with a coverage report in `coverage/`                 |
| `npm run check`                                  | lint, typecheck, tests and production build                      |
| `npm run build` / `npm run preview`              | production build in `dist/` and a local preview                  |
| `npm run puzzle -- --difficulty hard --solution` | generate puzzles in the terminal (`--seed`, `--count`, `--json`) |
| `npm run bench`                                  | board sampler throughput                                         |
| `npm run bench:browser`                          | generation time inside Chromium and WebKit                       |
| `npm run exp:enumerate`, `exp:bias`, `exp:dig`   | generator experiments (see below)                                |

To run the browser tests against the deployed site: `E2E_BASE_URL=https://alonkellner.com/5-to-5/ npm run test:e2e`.

### VS Code

Open the folder and accept the recommended extensions (ESLint, Prettier, Vitest). Then:

- **Testing** sidebar runs and debugs individual tests.
- **Run and Debug** has "Debug app in Chrome" (start `npm run dev` first), "Debug current test file"
  and "Generate a puzzle (CLI)".
- **Terminal → Run Build Task** (⇧⌘B) runs `npm run check`.

### Useful URLs

- `?d=expert` starts with a difficulty (`easy`, `medium`, `hard`, `expert`).
- `?seed=abc&d=hard` always generates the same puzzle.
- `?p=<code>` opens an exact puzzle; the app keeps the current puzzle in the address bar, so copying
  the URL shares it.

## How it works

```
src/
  core/            pure TypeScript, no DOM
    rng.ts         seedable PRNG, so every puzzle is reproducible from a seed
    board.ts       board encoding, symmetries, canonical keys
    rules.ts       the 240 valid (must, never) rule pairs
    validator.ts   the strict board rules
    clues.ts       tile and relation clues (65 slots)
    codec.ts       compact puzzle codes for links
    solver/        constraint propagation + search; counts solutions
    generator/     board sampling, clue digging, difficulty rating
  game/state.ts    immutable game state: moves, notes, checkpoints, hints, win detection
  ui/              rendering and interaction (pointer events for mouse and touch)
  worker/          runs the generator in a Web Worker
scripts/           CLI, benchmark and experiments
e2e/               Playwright tests
legacy/            the original single-file prototype and Colab experiments
```

**Generation** has two steps:

1. **Board:** shuffle the 25 tiles uniformly and keep the result only if it follows the rules. Every
   valid board is equally likely. Rules are checked while the shuffle is still being built, so most
   attempts stop after a few tiles (about 0.3 s per board).
2. **Clues:** start from all 65 clues and remove them in random order, keeping each removal only if
   the puzzle stays solvable with the deductions allowed at the chosen difficulty. What remains is
   a set where every clue is needed.

The solver treats the hidden rules as unknowns next to the cells and propagates at five levels
(counts and relations → never rules → must rules → exactness → single hypotheses). Difficulty is
the level a puzzle needs; "expert" puzzles need guessing.

The experiments behind these choices (exact count of all 1,178,718,720 valid boards, bias tests of
candidate samplers, and dig and difficulty measurements) are in
[docs/experiments/decision.md](docs/experiments/decision.md).
