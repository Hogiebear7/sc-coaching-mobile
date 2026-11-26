// The maths behind the time wheels. Each wheel column is one unit of a single running total of seconds (seconds, minutes, hours), so scrolling the seconds
// past 59 carries one into the minutes, and the minutes past 59 carry into the hours, and back down again the same way.

export interface WheelColumnSpec {
  /** Seconds in one step of this column: 1 for seconds, 60 for minutes, 3600 for hours. */
  unit: number;
  /** How many values the column shows before it wraps: 60 for seconds and minutes. The top column never wraps (null). */
  wrapAt: number | null;
}

/** The number a column shows for a total. */
export function columnValue(totalSecs: number, spec: WheelColumnSpec): number {
  const n = Math.floor(totalSecs / spec.unit);
  return spec.wrapAt ? n % spec.wrapAt : n;
}

/** The label `offset` rows from the middle, or "" when that would be outside 0 to maxTotal. */
export function columnLabelAt(totalSecs: number, spec: WheelColumnSpec, offset: number, maxTotal: number): string {
  const t = totalSecs + offset * spec.unit;
  if (t < 0 || t > maxTotal) return "";
  return String(columnValue(t, spec)).padStart(2, "0");
}

/** The new total after moving a column by `delta` steps, or null when that would go outside 0 to maxTotal (nothing changes). */
export function stepTotal(totalSecs: number, spec: WheelColumnSpec, delta: number, maxTotal: number): number | null {
  const next = totalSecs + delta * spec.unit;
  return next < 0 || next > maxTotal ? null : next;
}

/** Spin-down after a flick: the speed in rows per millisecond after `dtMs`, and how far it went (rows). */
export function flingStep(speed: number, dtMs: number): { speed: number; distance: number } {
  const TAU_MS = 380;
  const decay = Math.exp(-dtMs / TAU_MS);
  // Distance covered while the speed falls from `speed` to `speed * decay`.
  return { speed: speed * decay, distance: speed * TAU_MS * (1 - decay) };
}
