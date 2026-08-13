// Ported from the web app's lib/progress.ts sparklineSegments() — same
// gap-aware geometry (null values break the line into separate runs
// instead of interpolating across missing days).
export function sparklineSegments(
  values: (number | null)[],
  width: number,
  height: number,
  min = 0,
  max = 100
): string[] {
  if (values.length === 0) return [];
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const range = max - min || 1;
  const segments: string[] = [];
  let current: string[] = [];

  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = Math.round(i * stepX * 10) / 10;
    const y = Math.round((height - ((v - min) / range) * height) * 10) / 10;
    current.push(`${x},${y}`);
  });
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
}
