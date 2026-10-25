// Pure chart helpers, unit-tested in __tests__/chart-math.test.ts.

// Exponentially weighted moving average: the "trend weight" idea — daily
// scale readings bounce with water and food, the trend shows the real
// direction. alpha 0.1 matches the common Hacker's Diet smoothing; the first
// value seeds the series.
export function smoothTrend(values: number[], alpha = 0.1): number[] {
  const out: number[] = [];
  let prev: number | null = null;
  for (const v of values) {
    prev = prev === null ? v : prev + alpha * (v - prev);
    out.push(Math.round(prev * 100) / 100);
  }
  return out;
}
