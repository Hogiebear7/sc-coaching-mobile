import type { AmrapConfig, ChipperConfig, CircuitConfig, EmomConfig, TabataConfig, WorkoutFormat } from "@/lib/workout-draft";

// Circuit, EMOM, AMRAP, Tabata and Chipper used to save only a sentence in the workout note. This turns a finished one into real exercise entries,
// one per movement, so the history, the summary and the A1 / B1 labels treat it like any other workout. Nothing is saved unless the format was
// actually run (the member used its timer or card), because an empty plan is not a workout.

export interface FormatExerciseEntry {
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

const clock = (secs: number): string => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
const int = (text: string): number | null => {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function entry(name: string, order: number, sets: number, detail: { weight: string | null; reps: number | null }, notes: string): FormatExerciseEntry {
  const repeated = Array.from({ length: Math.max(1, sets) }, () => ({ ...detail }));
  return {
    exerciseId: null,
    name: name.trim(),
    weight: detail.weight,
    reps: detail.reps,
    sets: Math.max(1, sets),
    rir: null,
    setDetails: repeated,
    setType: null,
    supersetGroup: null,
    perSide: false,
    order,
    notes,
  };
}

/** How many of `count` repeating turns land on movement `i` when `turns` movements-in-a-row are cycled through. */
export function turnsFor(i: number, movements: number, count: number): number {
  if (movements <= 0 || count <= 0) return 0;
  return Math.floor(count / movements) + (i < count % movements ? 1 : 0);
}

/** "12 reps" or "40s" or "30 sec" as a rep count or a time, whichever it is. */
function parseTarget(text: string): { weight: string | null; reps: number | null } {
  const t = text.trim();
  if (!t) return { weight: null, reps: null };
  const reps = t.match(/^(\d+)\s*(reps?|x)?$/i);
  if (reps) return { weight: null, reps: parseInt(reps[1], 10) };
  const secs = t.match(/^(\d+)\s*(s|sec|secs|seconds?)$/i);
  if (secs) return { weight: clock(parseInt(secs[1], 10)), reps: null };
  return { weight: t, reps: null };
}

export interface FormatConfigs {
  circuit: CircuitConfig;
  amrap: AmrapConfig;
  emom: EmomConfig;
  tabata: TabataConfig;
  chipper: ChipperConfig;
}

export function formatEntries(format: WorkoutFormat, configs: FormatConfigs, ran: boolean, orderBase: number): FormatExerciseEntry[] {
  if (!ran) return [];
  let i = 0;
  const next = () => orderBase + i++;
  switch (format) {
    case "circuit": {
      const c = configs.circuit;
      const rounds = c.capMode === "sets" ? int(c.totalSets) ?? 1 : 1;
      return c.stations
        .filter((s) => s.name.trim())
        .map((s) => {
          const secs = int(s.seconds);
          return entry(
            s.name,
            next(),
            rounds,
            { weight: secs ? clock(secs) : null, reps: int(s.repTarget) },
            c.capMode === "sets" ? `Circuit: ${rounds} round${rounds === 1 ? "" : "s"}${secs ? `, ${secs}s per station` : ""}` : `Circuit: ${c.timeCapMins} min cap${secs ? `, ${secs}s per station` : ""}`
          );
        });
    }
    case "emom": {
      const c = configs.emom;
      const moves = c.movements.filter((m) => m.name.trim());
      const intervals = Math.floor(((int(c.totalMins) ?? 0) * 60) / (int(c.intervalSecs) ?? 60));
      return moves.map((m, k) => entry(m.name, next(), turnsFor(k, moves.length, intervals), parseTarget(m.repsOrTime), `EMOM: ${c.totalMins} min, every ${c.intervalSecs}s`));
    }
    case "tabata": {
      const c = configs.tabata;
      const moves = c.movements.filter((m) => m.trim());
      const rounds = int(c.rounds) ?? 8;
      return moves.map((name, k) => entry(name, next(), turnsFor(k, moves.length, rounds), { weight: `${c.workSecs}s on`, reps: null }, `Tabata: ${c.workSecs}s work / ${c.restSecs}s rest, ${rounds} rounds`));
    }
    case "amrap": {
      const c = configs.amrap;
      return c.movements
        .filter((m) => m.name.trim())
        .map((m) =>
          entry(m.name, next(), 1, { weight: null, reps: m.completedReps > 0 ? m.completedReps : null }, `AMRAP: ${c.timeCapMins} min${c.subMode === "rounds" && int(m.targetReps) ? `, ${m.targetReps} per round` : ""}`)
        );
    }
    case "chipper": {
      return configs.chipper.movements
        .filter((m) => m.name.trim())
        .map((m) =>
          m.mode === "time"
            ? entry(m.name, next(), 1, { weight: m.doneSeconds > 0 ? clock(m.doneSeconds) : null, reps: null }, `Chipper: ${m.targetSeconds ? `target ${clock(parseInt(m.targetSeconds, 10) || 0)}` : "for time"}`)
            : entry(m.name, next(), 1, { weight: null, reps: m.doneReps > 0 ? m.doneReps : null }, `Chipper: target ${m.targetReps || "—"} reps`)
        );
    }
    default:
      return [];
  }
}
