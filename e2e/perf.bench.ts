import { test } from '@playwright/test';

// Run with: npm run bench:browser (not part of the test suite)
test('generation time per difficulty', async ({ page }, info) => {
  test.setTimeout(600_000);
  await page.goto('./?d=easy');
  await page.locator('#game-board > *').first().waitFor();
  const results = await page.evaluate(async () => {
    const modulePath = '/5-to-5/src/core/generator/generate.ts';
    const { generatePuzzle } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import('../src/core/generator/generate');
    const out: Record<string, number[]> = {};
    for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
      out[difficulty] = [];
      for (let i = 0; i < 25; i++) {
        const t0 = performance.now();
        generatePuzzle({ seed: `bench-${i}`, difficulty });
        out[difficulty].push(performance.now() - t0);
      }
    }
    return out;
  });
  for (const [difficulty, times] of Object.entries(results)) {
    times.sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(
      `${info.project.name} ${difficulty}: mean ${mean.toFixed(0)} ms, median ${times[12]!.toFixed(0)} ms, p90 ${times[22]!.toFixed(0)} ms, max ${times[24]!.toFixed(0)} ms`,
    );
  }
});
