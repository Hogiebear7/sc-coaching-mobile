// Hyrox: 8 stations, each with a run before it (16 laps). The stations are fixed; the member only changes the distance (or reps) and the weight of
// each, and the length of the runs. One overall clock runs from the start, and each lap ends when the member taps Lap. The last lap ends the clock.
// Everything here is plain data and functions, so the screens only draw it. Weights are in kg.

export interface HyroxStation {
  key: string;
  /** Fixed. */
  name: string;
  /** "distance" stations are in metres; "reps" stations (wall balls) count reps. */
  kind: "distance" | "reps";
  /** Metres or reps, as typed. */
  amount: string;
  /** kg, as typed. Blank when the station has no weight. */
  weightKg: string;
}

export interface HyroxConfig {
  /** Length of each of the 8 runs, in metres. */
  runDistanceM: string;
  stations: HyroxStation[];
}

export interface HyroxSession {
  started: boolean;
  /** When the clock last started or resumed; null while it is paused or not started. */
  startedAtMs: number | null;
  /** Seconds already counted before the clock last started (so pausing never loses time). */
  accumulatedSecs: number;
  /** The overall time (seconds) at the end of each lap so far, oldest first. 16 of them means finished. */
  lapTotals: number[];
  finished: boolean;
  /** Roxzone: the time spent in the transition zones, timed on its own beside the laps. Absent on a race saved before this existed. */
  roxzoneSecs?: number;
  /** When the Roxzone clock was last started; null while it is stopped. */
  roxzoneStartedAtMs?: number | null;
}

export const HYROX_LAPS = 16;

export function defaultHyroxConfig(): HyroxConfig {
  const s = (key: string, name: string, kind: HyroxStation["kind"], amount: string, weightKg: string): HyroxStation => ({ key, name, kind, amount, weightKg });
  return {
    runDistanceM: "1000",
    stations: [
      s("skierg", "SkiErg", "distance", "1000", ""),
      s("sled-push", "Sled Push", "distance", "50", "125"),
      s("sled-pull", "Sled Pull", "distance", "50", "75"),
      s("burpee-broad-jump", "Burpee Broad Jump", "distance", "80", ""),
      s("row", "Row", "distance", "1000", ""),
      s("farmers-carry", "Farmers Carry", "distance", "200", "24"),
      s("sandbag-lunges", "Sandbag Lunges", "distance", "100", "20"),
      s("wall-balls", "Wall Balls", "reps", "100", "6"),
    ],
  };
}

export function emptyHyroxSession(): HyroxSession {
  return { started: false, startedAtMs: null, accumulatedSecs: 0, lapTotals: [], finished: false, roxzoneSecs: 0, roxzoneStartedAtMs: null };
}

export interface HyroxSegment {
  /** 0 to 15: run 1, station 1, run 2, station 2 ... */
  index: number;
  kind: "run" | "station";
  /** For a station, 1 to 8. */
  stationNumber: number | null;
  /** "Run 1", "SkiErg". */
  title: string;
  /** "1000 m", "50 m · 125 kg", "100 reps · 6 kg". */
  detail: string;
}

const num = (text: string): number | null => {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function stationDetail(st: HyroxStation): string {
  const amount = num(st.amount);
  const w = num(st.weightKg);
  const parts = [amount !== null ? (st.kind === "reps" ? `${amount} reps` : `${amount} m`) : ""];
  if (w !== null && w > 0) parts.push(`${w} kg`);
  return parts.filter(Boolean).join(" · ");
}

export function hyroxSegments(config: HyroxConfig): HyroxSegment[] {
  const out: HyroxSegment[] = [];
  config.stations.forEach((st, i) => {
    const run = num(config.runDistanceM);
    out.push({ index: out.length, kind: "run", stationNumber: null, title: `Run ${i + 1}`, detail: run !== null ? `${run} m` : "" });
    out.push({ index: out.length, kind: "station", stationNumber: i + 1, title: st.name, detail: stationDetail(st) });
  });
  return out;
}

/** The overall time in whole seconds. */
export function hyroxElapsed(session: HyroxSession, nowMs: number): number {
  const running = session.startedAtMs !== null ? Math.max(0, Math.floor((nowMs - session.startedAtMs) / 1000)) : 0;
  return session.accumulatedSecs + running;
}

/** Roxzone time so far in whole seconds, including the stretch that is running now. */
export function roxzoneElapsed(session: HyroxSession, nowMs: number): number {
  const running = session.roxzoneStartedAtMs ? Math.max(0, Math.floor((nowMs - session.roxzoneStartedAtMs) / 1000)) : 0;
  return (session.roxzoneSecs ?? 0) + running;
}

function stopRoxzone(session: HyroxSession, nowMs: number): HyroxSession {
  if (!session.roxzoneStartedAtMs) return session;
  return { ...session, roxzoneSecs: roxzoneElapsed(session, nowMs), roxzoneStartedAtMs: null };
}

/** Starts the Roxzone clock when you reach a transition zone, and stops it when you leave. Only while the race is running. */
export function hyroxRoxzoneToggle(session: HyroxSession, nowMs: number): HyroxSession {
  if (session.roxzoneStartedAtMs) return stopRoxzone(session, nowMs);
  if (!session.started || session.finished || session.startedAtMs === null) return session;
  return { ...session, roxzoneStartedAtMs: nowMs };
}

export function hyroxStart(session: HyroxSession, nowMs: number): HyroxSession {
  if (session.finished || session.startedAtMs !== null) return session;
  return { ...session, started: true, startedAtMs: nowMs };
}

export function hyroxPause(session: HyroxSession, nowMs: number): HyroxSession {
  if (session.startedAtMs === null) return session;
  return { ...stopRoxzone(session, nowMs), accumulatedSecs: hyroxElapsed(session, nowMs), startedAtMs: null };
}

/** Ends the current lap. The 16th lap stops the clock and finishes the race. */
export function hyroxLap(session: HyroxSession, nowMs: number): HyroxSession {
  if (!session.started || session.finished || session.startedAtMs === null) return session;
  const total = hyroxElapsed(session, nowMs);
  const lapTotals = [...session.lapTotals, total];
  const finished = lapTotals.length >= HYROX_LAPS;
  return finished ? { ...stopRoxzone(session, nowMs), lapTotals, finished: true, startedAtMs: null, accumulatedSecs: total } : { ...session, lapTotals };
}

/** Takes the last lap back (a mis-tap). If the race had finished, the clock carries on from where the last lap ended. */
export function hyroxUndoLap(session: HyroxSession, nowMs: number): HyroxSession {
  if (session.lapTotals.length === 0) return session;
  const lapTotals = session.lapTotals.slice(0, -1);
  if (session.finished) {
    // The clock runs on from the end of the lap before: nothing is lost, but the seconds since the finish are not counted.
    return { ...session, lapTotals, finished: false, startedAtMs: nowMs, accumulatedSecs: session.accumulatedSecs };
  }
  return { ...session, lapTotals };
}

/** The time of each lap on its own, in order. */
export function hyroxSplits(session: HyroxSession): number[] {
  return session.lapTotals.map((t, i) => t - (i === 0 ? 0 : session.lapTotals[i - 1]));
}

export function hyroxClock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export interface HyroxResult {
  total: number;
  runTotal: number;
  stationTotal: number;
  bestRun: number | null;
  roxzone: number;
}

export function hyroxResult(session: HyroxSession): HyroxResult {
  const splits = hyroxSplits(session);
  const runs = splits.filter((_, i) => i % 2 === 0);
  const stations = splits.filter((_, i) => i % 2 === 1);
  return {
    total: session.lapTotals.length ? session.lapTotals[session.lapTotals.length - 1] : 0,
    runTotal: runs.reduce((a, b) => a + b, 0),
    stationTotal: stations.reduce((a, b) => a + b, 0),
    bestRun: runs.length ? Math.min(...runs) : null,
    roxzone: session.roxzoneSecs ?? 0,
  };
}

export function hyroxSummaryNote(session: HyroxSession): string {
  if (session.lapTotals.length === 0) return "";
  const r = hyroxResult(session);
  const bits = [`${hyroxClock(r.total)} total${session.finished ? "" : ` (${session.lapTotals.length}/${HYROX_LAPS} laps)`}`];
  if (r.runTotal > 0) bits.push(`run total ${hyroxClock(r.runTotal)}`);
  if (r.bestRun !== null) bits.push(`best run ${hyroxClock(r.bestRun)}`);
  if (r.roxzone > 0) bits.push(`Roxzone ${hyroxClock(r.roxzone)}`);
  return bits.join(", ");
}

export interface HyroxRunEntry {
  distance: number | null;
  durationSecs: number;
  reps: null;
  sets: null;
  notes: string;
  cardioType: "run";
  order: number;
  supersetGroup: null;
}

export interface HyroxStationEntry {
  exerciseId: null;
  name: string;
  weight: string | null;
  reps: number | null;
  sets: number;
  rir: null;
  setDetails: { weight: string | null; reps: number | null }[];
  setType: null;
  supersetGroup: null;
  perSide: false;
  order: number;
  notes: string;
}

/**
 * What gets saved with the workout: each finished run as a cardio entry and each finished station as an exercise, in race order. `orderBase` keeps
 * them after any other entries. Only laps that were finished are saved.
 */
export function hyroxEntries(config: HyroxConfig, session: HyroxSession, orderBase: number): { runs: HyroxRunEntry[]; stations: HyroxStationEntry[] } {
  const segments = hyroxSegments(config);
  const splits = hyroxSplits(session);
  const runs: HyroxRunEntry[] = [];
  const stations: HyroxStationEntry[] = [];
  splits.forEach((secs, i) => {
    const seg = segments[i];
    if (!seg) return;
    const order = orderBase + i;
    if (seg.kind === "run") {
      const m = num(config.runDistanceM);
      runs.push({ distance: m !== null ? Math.round((m / 1000) * 1000) / 1000 : null, durationSecs: secs, reps: null, sets: null, notes: `Hyrox ${seg.title.toLowerCase()}`, cardioType: "run", order, supersetGroup: null });
    } else {
      const st = config.stations[(seg.stationNumber ?? 1) - 1];
      const amount = num(st.amount);
      const w = num(st.weightKg);
      const weight = w !== null && w > 0 ? `${w} kg` : null;
      const reps = st.kind === "reps" && amount !== null ? Math.round(amount) : null;
      const label = st.kind === "reps" ? `${amount ?? ""} ${st.name}`.trim() : `${amount ?? ""} m ${st.name}`.trim();
      stations.push({
        exerciseId: null,
        name: label,
        weight,
        reps,
        sets: 1,
        rir: null,
        setDetails: [{ weight, reps }],
        setType: null,
        supersetGroup: null,
        perSide: false,
        order,
        notes: `Hyrox station ${seg.stationNumber}: ${hyroxClock(secs)}`,
      });
    }
  });
  return { runs, stations };
}

/** "9:02", "1:02:05" or a bare number of minutes ("9") as seconds. Null when it is blank or not a time. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p.trim()))) return null;
  const n = parts.map((p) => parseInt(p, 10));
  if (n.length === 1) return n[0] * 60;
  if (n.some((v, i) => i > 0 && v > 59)) return null;
  return n.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2];
}
