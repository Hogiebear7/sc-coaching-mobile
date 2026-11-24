// A member's optional personal benchmarks: best 5-rep lifts (kg), max push-ups and pull-ups, plank hold and running times. Entered by the member, never
// required. Only the four lifts are used today (to suggest starting weights in the workout generator); the rest are kept for the profile and later.
// Pure helpers here (validation, time parsing and formatting) so they are unit tested; storage is in store.ts.

export interface BenchmarkValues {
  squat5rmKg?: number;
  deadlift5rmKg?: number;
  rdl5rmKg?: number;
  bench5rmKg?: number;
  maxPushUps?: number;
  maxPullUps?: number;
  plankSeconds?: number;
  run5kSeconds?: number;
  run10kSeconds?: number;
}

export type BenchmarkKey = keyof BenchmarkValues;

export interface BenchmarkField {
  key: BenchmarkKey;
  label: string;
  group: "strength" | "bodyweight" | "running";
  kind: "kg" | "count" | "time";
  min: number;
  max: number;
  hint: string;
}

// Ranges are sanity checks to catch a typo (an extra zero, grams for kilos), not coaching limits.
export const BENCHMARK_FIELDS: BenchmarkField[] = [
  { key: "squat5rmKg", label: "Squat", group: "strength", kind: "kg", min: 10, max: 600, hint: "kg for 5 clean reps" },
  { key: "deadlift5rmKg", label: "Deadlift", group: "strength", kind: "kg", min: 10, max: 600, hint: "kg for 5 clean reps" },
  { key: "rdl5rmKg", label: "Romanian deadlift", group: "strength", kind: "kg", min: 10, max: 600, hint: "kg for 5 clean reps" },
  { key: "bench5rmKg", label: "Bench press", group: "strength", kind: "kg", min: 5, max: 500, hint: "kg for 5 clean reps" },
  { key: "maxPushUps", label: "Push-ups", group: "bodyweight", kind: "count", min: 1, max: 500, hint: "most in one go" },
  { key: "maxPullUps", label: "Pull-ups", group: "bodyweight", kind: "count", min: 1, max: 100, hint: "most in one go" },
  { key: "plankSeconds", label: "Plank", group: "bodyweight", kind: "time", min: 5, max: 7200, hint: "longest hold, mm:ss" },
  { key: "run5kSeconds", label: "5 km run", group: "running", kind: "time", min: 600, max: 5400, hint: "best time, mm:ss" },
  { key: "run10kSeconds", label: "10 km run", group: "running", kind: "time", min: 1200, max: 10800, hint: "best time, mm:ss" },
];

/** "mm:ss", "h:mm:ss" or plain minutes ("25") to seconds. Bad input gives null. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60; // "25" = 25 minutes
  if (nums.length === 2) return nums[1] < 60 ? nums[0] * 60 + nums[1] : null;
  return nums[1] < 60 && nums[2] < 60 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : null;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Turns what was typed into a value, or tells the screen what to say. Empty means "not entered" (fine). */
export function parseField(field: BenchmarkField, text: string): { value: number | null; error: string | null } {
  const t = text.trim();
  if (!t) return { value: null, error: null };
  const raw = field.kind === "time" ? parseDuration(t) : Number(t.replace(",", "."));
  if (raw === null || !Number.isFinite(raw)) {
    return { value: null, error: field.kind === "time" ? `${field.label}: use minutes and seconds, like 24:30.` : `${field.label}: enter a number.` };
  }
  const value = field.kind === "kg" ? Math.round(raw * 2) / 2 : Math.round(raw);
  if (value < field.min || value > field.max) {
    const range = field.kind === "time" ? `${formatDuration(field.min)} to ${formatDuration(field.max)}` : `${field.min} to ${field.max}${field.kind === "kg" ? " kg" : ""}`;
    return { value: null, error: `${field.label}: that looks off. Expected ${range}.` };
  }
  return { value, error: null };
}

export function displayValue(field: BenchmarkField, value: number | undefined): string {
  if (value === undefined) return "";
  return field.kind === "time" ? formatDuration(value) : String(value);
}

/** Cleans whatever was saved. Never throws. */
export function parseBenchmarks(raw: unknown): BenchmarkValues {
  const r = raw as Record<string, unknown> | null;
  const out: BenchmarkValues = {};
  if (!r || typeof r !== "object") return out;
  for (const f of BENCHMARK_FIELDS) {
    const v = r[f.key];
    if (typeof v === "number" && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = v;
  }
  return out;
}

export function hasAnyBenchmark(values: BenchmarkValues): boolean {
  return Object.keys(values).length > 0;
}

/** Just the four lifts the session generator reads. Null when none are entered, so it suggests no weights. */
export function toEngineBenchmarks(values: BenchmarkValues): { squat5rmKg?: number; deadlift5rmKg?: number; rdl5rmKg?: number; bench5rmKg?: number } | null {
  const out = {
    squat5rmKg: values.squat5rmKg,
    deadlift5rmKg: values.deadlift5rmKg,
    rdl5rmKg: values.rdl5rmKg,
    bench5rmKg: values.bench5rmKg,
  };
  return Object.values(out).some((v) => v !== undefined) ? out : null;
}
