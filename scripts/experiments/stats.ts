/** Regularized lower incomplete gamma P(a, x) (Numerical Recipes, series + continued fraction). */
function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.5053203294168, 24.01409824083091, -1.231739572450155,
    0.001208650973866179, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.00000000019;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.506628274631 * ser) / x);
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** P(X ≥ chi2) for a chi-square distribution with `df` degrees of freedom. */
export function chiSquarePValue(chi2: number, df: number): number {
  return 1 - gammaP(df / 2, chi2 / 2);
}

export interface GoodnessOfFit {
  chi2: number;
  df: number;
  pValue: number;
}

/**
 * Chi-square goodness of fit of observed counts against expected probabilities. Bins with an
 * expected count below 5 are pooled together.
 */
export function goodnessOfFit(
  observed: Record<string, number>,
  expectedWeights: Record<string, number>,
): GoodnessOfFit {
  const n = Object.values(observed).reduce((a, b) => a + b, 0);
  const totalWeight = Object.values(expectedWeights).reduce((a, b) => a + b, 0);
  const keys = new Set([...Object.keys(observed), ...Object.keys(expectedWeights)]);
  const bins: { o: number; e: number }[] = [];
  const pooled = { o: 0, e: 0 };
  for (const key of keys) {
    const e = ((expectedWeights[key] ?? 0) / totalWeight) * n;
    const o = observed[key] ?? 0;
    if (e < 5) {
      pooled.o += o;
      pooled.e += e;
    } else bins.push({ o, e });
  }
  if (pooled.e > 0) {
    if (pooled.e >= 5 || bins.length === 0) bins.push(pooled);
    else {
      const smallest = bins.reduce((a, b) => (a.e < b.e ? a : b));
      smallest.o += pooled.o;
      smallest.e += pooled.e;
    }
  }
  const chi2 = bins.reduce(
    (acc, { o, e }) => acc + (e > 0 ? (o - e) ** 2 / e : o > 0 ? Infinity : 0),
    0,
  );
  const df = Math.max(1, bins.length - 1);
  return { chi2, df, pValue: chiSquarePValue(chi2, df) };
}
