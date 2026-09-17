# Generator design decisions

This records the experiments behind the puzzle generator and what was chosen. All numbers come
from the scripts in `scripts/experiments/` and `scripts/bench.ts`, run in Node 22 on an
Apple Silicon Mac (12 cores). Raw outputs are written to `docs/experiments/data/` (git-ignored).

## Problem recap

- A board is valid when each color has 5 tiles, exactly one color touches every copy of it
  (its _must_ neighbor), exactly one color touches no copy (its _never_ neighbor), and _must_ is an
  involution (_never_ always is).
- There are 26 involutions on 5 colors, 240 valid (must, never) pairs, and 3 classes of pairs up to
  relabeling colors (60, 60 and 120 pairs).
- A puzzle is a valid board plus a subset of its 65 clues (25 tiles, 40 edge relations) that has
  exactly one valid completion.

## Exp-1: exact enumeration (ground truth)

`npm run exp:enumerate` enumerates every valid board for one ruleset of each class with the solver
(rules pinned), split over 375 subproblems on 11 threads. **89 seconds.**

| class | example must / never | labelings | boards per labeling | share of all boards |
| ----- | -------------------- | --------- | ------------------- | ------------------- |
| 0     | `01243` / `10324`    | 60        | 1,612,880           | 8.2%                |
| 1     | `02143` / `10234`    | 60        | 12,900,008          | 65.7%               |
| 2     | `02143` / `10324`    | 120       | 2,566,212           | 26.1%               |

- **1,178,718,720 valid boards** out of 623,360,743,125,120 arrangements of the 25 tiles:
  density **1.891 × 10⁻⁶**, about one valid board per 529,000 random arrangements.
- Reference feature distributions (share of boards): largest single-color region 3 (54.3%),
  4 (6.2%), 5 (39.5%); same-color adjacent pairs mostly 4–6 (65.8%).

## Exp-2: sampler throughput

`npm run bench`, 60 boards each:

| sampler                         | trials/s | ms per board: mean / median / p90 / max |
| ------------------------------- | -------- | --------------------------------------- |
| rejection (shuffle, then check) | 866k     | 601 / 451 / 1399 / 2407                 |
| **early rejection**             | 1.54M    | **309 / 221 / 652 / 1795**              |

Early rejection fills the Fisher–Yates shuffle from the last cell backwards and checks the rules
on the already-final suffix after every step, abandoning the shuffle as soon as it must fail. The
accepted arrangement is still a uniform shuffle, so the output distribution is unchanged, but most
trials stop after a few cells. A property test replays 20,000 boards through the incremental
checker and compares with the full validator.

Board sampling dominates generation time. In the browser it runs in a Web Worker with progress
reports.

Whole-puzzle generation inside real browser engines (`npm run bench:browser`, 25 puzzles per tier,
same Mac):

| engine                           | easy: mean / median / p90 / max | medium                | hard                   | expert                |
| -------------------------------- | ------------------------------- | --------------------- | ---------------------- | --------------------- |
| Chromium (V8)                    | 360 / 201 / 716 / 3108 ms       | 228 / 180 / 562 / 650 | 262 / 217 / 670 / 1008 | 251 / 200 / 465 / 857 |
| WebKit (Safari's JavaScriptCore) | 238 / 127 / 447 / 2132 ms       | 149 / 122 / 380 / 405 | 174 / 138 / 460 / 634  | 171 / 139 / 318 / 592 |

The WebKit run emulates an iPhone screen but uses the Mac's CPU; phones are typically 2–4× slower,
which still keeps the median well under a second. **Still to measure:** a real phone.

## Exp-3: sampler bias

`npm run exp:bias -- --boards 3300`: chi-square goodness of fit of four board features against the
Exp-1 distribution, plus duplicate boards up to symmetry and relabeling (birthday test).

| sampler                                         | cpu ms/board¹ | χ² ruleset class | χ² same-color pairs | χ² regions   | χ² largest region | duplicates (observed vs uniform) |
| ----------------------------------------------- | ------------- | ---------------- | ------------------- | ------------ | ----------------- | -------------------------------- |
| **early rejection** (exact)                     | 474           | 0.5, p=0.80      | 7.8, p=0.73         | 12.3, p=0.26 | 4.0, p=0.14       | 3 vs 4.4                         |
| randomized DFS                                  | 0.6           | 2154, p≈0        | 1946, p≈0           | 2044, p≈0    | 42.5, p≈10⁻⁹      | 43 vs 4.4                        |
| randomized DFS + random symmetry and relabeling | 0.3           | 1936, p≈0        | 1719, p≈0           | 1795, p≈0    | 36.3, p≈10⁻⁸      | 46 vs 4.4                        |

¹ Measured with all cores busy, so slower than Exp-2.

**Decision:** use early rejection. It is exactly uniform and passes every test; randomized DFS is
~800× faster but strongly biased, and randomizing symmetry and colors does not repair it (the bias
is in board structure, not orientation or color names). MCMC (swap moves) was not pursued: the
valid set is sparse (density 2 × 10⁻⁶), mixing would be hard to certify, and exact sampling is
already fast enough.

## Exp-4/5: clue digging and difficulty

`npm run exp:dig -- --boards 100`. Each criterion removes clues in a random order and keeps a
removal only while the criterion holds; one pass leaves a set where every clue is necessary.
Propagation levels: P0 counts and relations, P1 never-rule reasoning, P2 must-rule reasoning,
P3 exactness (only one color may be common / missing), P4 single hypotheses (assume a cell color or
a rule, propagate, eliminate on contradiction).

| criterion                   | ms mean | ms p95 | clues | tiles | needs P0 / P1 / P2 / P3 / P4 / search | search nodes p50 / p90 / max | guess depth p50 / max |
| --------------------------- | ------- | ------ | ----- | ----- | ------------------------------------- | ---------------------------- | --------------------- |
| P0                          | 0.3     | 1.0    | 20.2  | 7.0   | 100 / 0 / 0 / 0 / 0 / 0 %             | 1 / 1 / 1                    | 0 / 0                 |
| P1                          | 0.2     | 0.3    | 17.5  | 6.2   | 0 / 100 / 0 / 0 / 0 / 0 %             | 1 / 1 / 1                    | 0 / 0                 |
| P2                          | 0.3     | 0.4    | 15.0  | 5.7   | 0 / 0 / 100 / 0 / 0 / 0 %             | 1 / 1 / 1                    | 0 / 0                 |
| P3                          | 0.4     | 0.4    | 14.8  | 5.9   | 0 / 0 / 94 / 6 / 0 / 0 %              | 1 / 1 / 1                    | 0 / 0                 |
| P4                          | 13.1    | 19.0   | 13.3  | 4.9   | 0 / 0 / 0 / 0 / 100 / 0 %             | 142 / 901 / 5325             | 7 / 11                |
| uniqueness                  | 31.1    | 142.3  | 12.3  | 4.3   | 0 / 0 / 0 / 0 / 19 / 81 %             | 420 / 4024 / 25347           | 9 / 13                |
| uniqueness, tiles first     | 134.2   | 684.2  | 12.4  | 1.0   | 0 / 0 / 0 / 0 / 3 / 97 %              | 1643 / 16695 / 304010        | 10 / 14               |
| uniqueness, relations first | 2.5     | 5.2    | 12.1  | 12.1  | 0 / 0 / 0 / 1 / 69 / 30 %             | 65 / 217 / 579               | 7 / 11                |

Findings:

- Digging by "still solvable at level L" produces puzzles that need exactly level L, cheaply.
  This is the classic Sudoku technique-bounded dig, and it gives difficulty control without search.
- P0 puzzles never require discovering the hidden rules, so they are not used.
- Uniqueness-only digging gives the fewest clues but usually needs deep guessing (median depth 9):
  the "expert" tier.
- Dig order strongly changes the clue mix: relations first leaves only tile clues; tiles first
  leaves about one tile and the hardest puzzles. The default is a uniformly random order.
- The legacy hand-made puzzle needs P4, matching the "hard" tier.
- An "alternative solution cache" was tried and removed: within one pass it can never hit, because
  an alternative found when removing clue _s_ differs from the solution only on hidden clues and on
  _s_, which is then kept.

**First decision (superseded by Exp-6):** four tiers by the strongest deduction needed. Scores
jumped from ~250 (medium) to ~500 (hard), because the score was essentially 100 × tier.

## Exp-6: effort-based score and seven levels

Goal: 7 levels whose average scores are about 100 × level, with even steps between levels.

**Grader** (`src/core/generator/grade.ts`): solve like a person. Repeatedly apply _one round_ of the
weakest deduction that makes progress (counts and relations, never rules, must rules, exactness);
when none helps, find one hypothesis that leads to a contradiction; when that fails too, search
from the stuck position. Effort is a weighted sum:

| step                              | weight |
| --------------------------------- | ------ |
| round of counts/relations (P0)    | 1      |
| round of never reasoning (P1)     | 2      |
| round of must reasoning (P2)      | 3      |
| round of exactness reasoning (P3) | 5      |
| one eliminating hypothesis (P4)   | 8      |
| one search node once stuck        | 10     |

Counting single rounds matters: with full fixpoints, every puzzle below P4 took exactly one step
per level, so nothing distinguished puzzles within a tier.

`npm run exp:grading -- --boards 60` graded puzzles dug with every criterion, plus easier variants
with 2, 4 or 8 hidden clues added back. log₂(effort) turned out continuous across the pool:

| puzzles                                | log₂ effort p10 / p50 / p90 |
| -------------------------------------- | --------------------------- |
| P1-dug                                 | 3.2 / 3.6 / 4.0             |
| P2- and P3-dug                         | 4.4 / 4.9 / 5.3             |
| P4-dug with 2–4 clues added back       | 4.4–5.6 / 6.2–6.9 / 7.1–7.8 |
| P4-dug                                 | 7.4 / 8.0 / 8.4             |
| uniqueness-dug with 2 clues added back | 6.4 / 7.7 / 11.2            |
| uniqueness-dug                         | 8.3 / 11.2 / 14.4           |

**Score** = 100 + 75 × (log₂ effort − 3.5), so a score of 100 is a typical never-rule puzzle, 700
a typical minimal puzzle that needs guessing, and each 100 points is ~2.5× more effort. A puzzle's
level is its score rounded to the nearest hundred, clamped to 1–7.

**Generation per level:** dig with the criterion "unique and score ≤ cap", with the cap drawn from
[100·level − 20, 100·level + 49]. A dig ends at or below its cap (usually ~20 below), so the caps
sit in the upper part of the band. Up to 6 digs per board; keep the in-level result closest to
100·level and stop early within ±15. Calibration (`npm run exp:levels -- --boards 60 --digs N`):

| level      | 1 dig, caps over the whole band: mean score / board yields level | 6 digs, final: mean score (range) | board yields level | ms per board mean / p90 | clues | needs guessing |
| ---------- | ---------------------------------------------------------------- | --------------------------------- | ------------------ | ----------------------- | ----- | -------------- |
| 1 Beginner | 78 / 100%                                                        | 103 (87–123)                      | 100%               | 2 / 4                   | 18.1  | 0%             |
| 2 Easy     | 194 / 90%                                                        | 197 (177–216)                     | 100%               | 11 / 27                 | 15.5  | 0%             |
| 3 Medium   | 288 / 83%                                                        | 301 (284–316)                     | 100%               | 22 / 50                 | 14.9  | 0%             |
| 4 Tricky   | 382 / 80%                                                        | 400 (385–415)                     | 100%               | 53 / 111                | 13.7  | 3%             |
| 5 Hard     | 484 / 48%                                                        | 501 (456–533)                     | 98%                | 124 / 227               | 13.2  | 92%            |
| 6 Expert   | 576 / 38%                                                        | 593 (553–632)                     | 95%                | 108 / 189               | 12.8  | 100%           |
| 7 Master   | 676 / 18%                                                        | 691 (653–742)                     | 90%                | 147 / 215               | 12.6  | 100%           |

Whole-puzzle generation in browsers (`npm run bench:browser`, 25 puzzles per level, including
board sampling):

| level | Chromium mean / median / p90 ms | WebKit mean / median / p90 ms |
| ----- | ------------------------------- | ----------------------------- |
| 1     | 259 / 188 / 468                 | 175 / 125 / 301               |
| 2     | 306 / 174 / 828                 | 203 / 121 / 538               |
| 3     | 201 / 148 / 405                 | 134 / 102 / 263               |
| 4     | 250 / 237 / 470                 | 165 / 156 / 319               |
| 5     | 378 / 349 / 691                 | 257 / 229 / 453               |
| 6     | 420 / 303 / 664                 | 290 / 211 / 469               |
| 7     | 432 / 398 / 880                 | 297 / 268 / 612               |

Notes:

- The effort score is not strictly monotone in the clues (removing a clue can occasionally open an
  easier solving path), so score-capped digs do not guarantee every remaining clue is necessary.
  Every puzzle is still verified unique.
- The weights and the 3.5 / 11.5 anchors are judgment calls; playtesting should confirm that the
  steps between levels feel even.

## Known limitations of "unbiased"

- Boards are exactly uniform over all valid boards.
- Given a board, clue sets are uniformly random _dig orders_, not uniform over all minimal clue
  sets (no known efficient way to sample those).
- Level retries (up to 6 digs per board, then a new board) slightly favor boards that more easily
  produce puzzles of the requested level, most noticeably for level 7 (90% of boards succeed).
- Levels are based on a model of solving effort, a proxy for human difficulty; they should be
  checked by playing a few puzzles of each level.
