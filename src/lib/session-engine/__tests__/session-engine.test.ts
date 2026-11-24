import { describe, expect, it } from "vitest";

import { deriveFlags, generateSession, suggestWeight, type LibraryExercise, type SessionRequest } from "../index";

// A small synthetic library shaped like the real one (taxonomy fields as in the exercises table).
let n = 0;
function ex(name: string, o: Partial<{ level: string; equipment: string; bodyPart: string; mechanic: string; forceType: string; region: string; position: string; laterality: string; loadType: string; family: string }> = {}): LibraryExercise {
  n += 1;
  return {
    id: `ex-${n}`,
    name,
    bodyPart: o.bodyPart ?? "upper legs",
    equipment: o.equipment ?? "body weight",
    difficulty: o.level ?? "beginner",
    approved: true,
    taxonomy: {
      mechanic: o.mechanic ?? "compound",
      forceType: o.forceType ?? "knee_dominant",
      primaryRegion: o.region ?? "lower_body",
      bodyPosition: o.position ?? "standing",
      laterality: o.laterality ?? "bilateral",
      loadType: o.loadType ?? "free_weight",
      movementFamily: o.family ?? name.toLowerCase(),
    },
  };
}

const LIB: LibraryExercise[] = [
  // lower push (squat family)
  ex("Bodyweight Squat", { level: "beginner", loadType: "bodyweight" }),
  ex("Supported Squat", { level: "beginner", loadType: "bodyweight", position: "supported" }),
  ex("Goblet Squat", { level: "beginner", equipment: "kettlebell" }),
  ex("Barbell Back Squat", { level: "intermediate", equipment: "barbell" }),
  ex("Barbell Front Squat", { level: "advanced", equipment: "barbell" }),
  ex("Zercher Squat", { level: "advanced", equipment: "barbell" }),
  ex("Dumbbell Lunge", { level: "intermediate", equipment: "dumbbell", laterality: "unilateral_lower" }),
  ex("Leg Press", { level: "beginner", equipment: "leverage machine", loadType: "machine_load", position: "seated" }),
  ex("Jump Squat", { level: "intermediate", mechanic: "plyometric", forceType: "explosive", loadType: "bodyweight" }),
  // lower pull (hinge)
  ex("Dumbbell Romanian Deadlift", { level: "beginner", equipment: "dumbbell", forceType: "hip_dominant", bodyPart: "upper legs" }),
  ex("Kettlebell Deadlift", { level: "beginner", equipment: "kettlebell", forceType: "hip_dominant" }),
  ex("Barbell Deadlift", { level: "intermediate", equipment: "barbell", forceType: "hip_dominant" }),
  ex("Barbell Romanian Deadlift", { level: "intermediate", equipment: "barbell", forceType: "hip_dominant" }),
  ex("Glute Bridge", { level: "beginner", forceType: "hip_dominant", position: "lying", loadType: "bodyweight", mechanic: "compound" }),
  ex("Hamstring Curl", { level: "beginner", equipment: "leverage machine", forceType: "hip_dominant", loadType: "machine_load", position: "seated", mechanic: "isolation" }),
  // upper push
  ex("Push Up", { level: "beginner", bodyPart: "chest", forceType: "push", region: "upper_body", position: "prone", loadType: "bodyweight" }),
  ex("Incline Push Up", { level: "beginner", bodyPart: "chest", forceType: "push", region: "upper_body", loadType: "bodyweight", position: "standing" }),
  ex("Dumbbell Bench Press", { level: "beginner", equipment: "dumbbell", bodyPart: "chest", forceType: "push", region: "upper_body", position: "lying" }),
  ex("Seated Dumbbell Shoulder Press", { level: "beginner", equipment: "dumbbell", bodyPart: "shoulders", forceType: "push", region: "upper_body", position: "seated" }),
  ex("Barbell Bench Press", { level: "intermediate", equipment: "barbell", bodyPart: "chest", forceType: "push", region: "upper_body", position: "lying" }),
  ex("Barbell Overhead Press", { level: "intermediate", equipment: "barbell", bodyPart: "shoulders", forceType: "push", region: "upper_body" }),
  // upper pull
  ex("Single-Arm Dumbbell Row", { level: "beginner", equipment: "dumbbell", bodyPart: "back", forceType: "pull", region: "upper_body", position: "bent_over", laterality: "unilateral_upper" }),
  ex("Seated Cable Row", { level: "beginner", equipment: "cable", bodyPart: "back", forceType: "pull", region: "upper_body", position: "seated", loadType: "cable_resistance" }),
  ex("Lat Pulldown", { level: "beginner", equipment: "cable", bodyPart: "back", forceType: "pull", region: "upper_body", position: "seated", loadType: "cable_resistance" }),
  ex("Barbell Bent Over Row", { level: "intermediate", equipment: "barbell", bodyPart: "back", forceType: "pull", region: "upper_body", position: "bent_over" }),
  ex("Pull Up", { level: "advanced", bodyPart: "back", forceType: "pull", region: "upper_body", position: "hanging", loadType: "bodyweight" }),
  ex("Band Pull Apart", { level: "beginner", equipment: "band", bodyPart: "shoulders", forceType: "pull", region: "upper_body", loadType: "band_resistance", mechanic: "compound" }),
  // core
  ex("Plank", { level: "beginner", bodyPart: "waist", forceType: "core_stability", region: "core", mechanic: "isometric", loadType: "bodyweight", position: "prone" }),
  ex("Dead Bug", { level: "beginner", bodyPart: "waist", forceType: "core_stability", region: "core", mechanic: "core", loadType: "bodyweight", position: "lying" }),
  ex("Bird Dog", { level: "beginner", bodyPart: "waist", forceType: "core_stability", region: "core", mechanic: "core", loadType: "bodyweight", position: "all_fours" }),
  ex("Crunch", { level: "beginner", bodyPart: "waist", forceType: "core_flexion", region: "core", mechanic: "core", loadType: "bodyweight", position: "lying" }),
  ex("Russian Twist", { level: "intermediate", bodyPart: "waist", forceType: "rotation", region: "core", mechanic: "core", loadType: "bodyweight", position: "seated" }),
  ex("Pallof Press", { level: "beginner", bodyPart: "waist", forceType: "core_stability", region: "core", equipment: "cable", mechanic: "core", loadType: "cable_resistance" }),
  // cardio / tempo
  ex("Stationary Bike", { level: "beginner", bodyPart: "cardio", forceType: "locomotion", region: "cardio", mechanic: "cardio", equipment: "stationary bike", loadType: "cardio_machine", position: "seated" }),
  ex("Ski Erg", { level: "beginner", bodyPart: "cardio", forceType: "locomotion", region: "cardio", mechanic: "cardio", equipment: "skierg machine", loadType: "cardio_machine" }),
  ex("Battle Ropes", { level: "intermediate", bodyPart: "cardio", forceType: "locomotion", region: "cardio", mechanic: "cardio", equipment: "rope", loadType: "free_weight" }),
  ex("Burpee", { level: "intermediate", bodyPart: "cardio", forceType: "explosive", region: "cardio", mechanic: "plyometric", loadType: "bodyweight" }),
  ex("Medicine Ball Slam", { level: "intermediate", bodyPart: "cardio", forceType: "throw", region: "cardio", mechanic: "plyometric", equipment: "medicine ball" }),
  ex("Farmer's Carry", { level: "intermediate", bodyPart: "lower arms", forceType: "carry", region: "full_body", mechanic: "compound", equipment: "dumbbell" }),
];

function req(over: Partial<SessionRequest> = {}): SessionRequest {
  return { level: "beginner", intent: "strength", format: "standard", split: "fullBody", timeMinutes: 45, equipment: [], ...over };
}

// A deterministic random source so a failing case can be reproduced.
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function plan(over: Partial<SessionRequest>, seed = 1) {
  return generateSession(LIB, req(over), seeded(seed));
}

const byId = new Map(LIB.map((e) => [e.id, e]));
const flagsOf = (id: string) => deriveFlags(byId.get(id)!);

describe("level", () => {
  it("never gives a beginner an intermediate or advanced exercise", () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const e of plan({ level: "beginner" }, seed).exercises) expect(flagsOf(e.exerciseId).level).toBe("beginner");
    }
  });

  it("lets an advanced member have advanced exercises", () => {
    const levels = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const e of plan({ level: "advanced" }, seed).exercises) levels.add(flagsOf(e.exerciseId).level);
    expect(levels.has("advanced")).toBe(true);
  });

  it("always gives sets, reps and an effort cue", () => {
    for (let seed = 1; seed <= 15; seed++) {
      for (const e of plan({ level: "intermediate" }, seed).exercises) {
        expect(e.sets).toBeGreaterThanOrEqual(1);
        expect(e.reps.length).toBeGreaterThan(0);
        expect(e.cue).toMatch(/RPE \d/);
      }
    }
  });
});

describe("structure", () => {
  it("puts a lower-push or upper-pull style pair first: the second exercise is the opposite half and opposite movement", () => {
    const opposite: Record<string, string> = { upper_pull: "lower_push", upper_push: "lower_pull", lower_push: "upper_pull", lower_pull: "upper_push" };
    for (let seed = 1; seed <= 30; seed++) {
      const e = plan({ level: "intermediate", timeMinutes: 45 }, seed).exercises;
      expect(e.length).toBeGreaterThanOrEqual(4);
      expect(e[0].role).toBe("main");
      expect(e[1].role).toBe("complement");
      expect(e[1].bucket).toBe(opposite[e[0].bucket as string]);
      expect(e[2].role).toBe("main");
      expect(e[3].bucket).toBe(opposite[e[2].bucket as string]);
    }
  });

  it("covers all four movement groups in a full-body session", () => {
    const e = plan({ level: "intermediate" }, 3).exercises.slice(0, 4);
    expect(new Set(e.map((x) => x.bucket)).size).toBe(4);
  });

  it("leads with the harder exercise and follows with an easier one", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const e = plan({ level: "intermediate" }, seed).exercises;
      expect(flagsOf(e[1].exerciseId).hardness).toBeLessThanOrEqual(flagsOf(e[0].exerciseId).hardness);
    }
  });

  it("keeps an upper-body day to upper-body groups plus core and cardio", () => {
    const allowed = new Set(["upper_push", "upper_pull", "core", "tempo"]);
    for (const e of plan({ split: "upper", level: "intermediate" }, 5).exercises) expect(allowed.has(e.bucket as string)).toBe(true);
  });

  it("adds a cardio exercise to a conditioning session", () => {
    const e = plan({ intent: "conditioning", level: "intermediate", timeMinutes: 50 }, 4).exercises;
    expect(e.some((x) => x.bucket === "tempo")).toBe(true);
  });

  it("never puts two exercises from the same family in one session", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const fams = plan({ level: "advanced", timeMinutes: 60 }, seed).exercises.map((x) => flagsOf(x.exerciseId).family);
      expect(new Set(fams).size).toBe(fams.length);
    }
  });
});

describe("grip", () => {
  it("never places two heavy-grip exercises next to each other", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const e = plan({ level: "advanced", timeMinutes: 60 }, seed).exercises;
      for (let i = 1; i < e.length; i++) expect(flagsOf(e[i - 1].exerciseId).grip + flagsOf(e[i].exerciseId).grip).toBeLessThanOrEqual(4);
      expect(e.reduce((sum, x) => sum + flagsOf(x.exerciseId).grip, 0)).toBeLessThanOrEqual(8);
    }
  });

  it("rates a barbell deadlift and a farmer's carry as high grip, and a machine exercise as none", () => {
    expect(deriveFlags(LIB.find((x) => x.name === "Barbell Deadlift")!).grip).toBe(3);
    expect(deriveFlags(LIB.find((x) => x.name === "Farmer's Carry")!).grip).toBe(3);
    expect(deriveFlags(LIB.find((x) => x.name === "Leg Press")!).grip).toBe(0);
  });
});

describe("yesterday", () => {
  it("gives no main squat-pattern lift the day after squats, only a light one at most", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = plan({ level: "intermediate", context: { trainedYesterday: ["lower_push"] } }, seed);
      for (const e of p.exercises.filter((x) => x.bucket === "lower_push")) {
        expect(e.role).not.toBe("main");
        expect(flagsOf(e.exerciseId).hardness).toBeLessThanOrEqual(2);
      }
      expect(p.notes.join(" ")).toMatch(/yesterday/);
    }
  });
});

describe("pregnancy", () => {
  it("leaves out lying-on-back, face-down, crunch and high-impact work from the second trimester, and says so", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = plan({ level: "intermediate", context: { pregnancy: { stage: "second" } } }, seed);
      for (const e of p.exercises) {
        const f = flagsOf(e.exerciseId);
        expect(f.supine).toBe(false);
        expect(f.prone).toBe(false);
        expect(f.coreFlexion).toBe(false);
        expect(f.impact).toBeLessThan(2);
      }
      expect(p.notes.join(" ")).toMatch(/Pregnancy \(second trimester\)/);
      expect(p.notes.join(" ")).toMatch(/not medical advice/);
    }
  });

  it("caps an advanced member at intermediate and the effort at 7 out of 10 in the second trimester", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const e of plan({ level: "advanced", context: { pregnancy: { stage: "second" } } }, seed).exercises) {
        expect(flagsOf(e.exerciseId).level).not.toBe("advanced");
        expect(Number(/RPE (\d)/.exec(e.cue)![1])).toBeLessThanOrEqual(7);
      }
    }
  });

  it("also avoids single-leg balance and impact in the third trimester, and uses no supersets", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = plan({ level: "intermediate", context: { pregnancy: { stage: "third" } } }, seed);
      for (const e of p.exercises) {
        expect(flagsOf(e.exerciseId).balance).toBe(false);
        expect(flagsOf(e.exerciseId).impact).toBe(0);
        expect(e.supersetGroup).toBeNull();
        expect(Number(/RPE (\d)/.exec(e.cue)![1])).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("injury", () => {
  it("leaves out balance, impact and stepping work for a sore ankle, and says so", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = plan({ level: "beginner", context: { injuries: ["ankle"] } }, seed);
      for (const e of p.exercises) expect(flagsOf(e.exerciseId).avoidFor).not.toContain("ankle");
      expect(p.notes.join(" ")).toMatch(/ankle/);
    }
  });

  it("keeps a sore shoulder out of overhead and hanging work", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const e of plan({ level: "advanced", context: { injuries: ["shoulder"] } }, seed).exercises) {
        const f = flagsOf(e.exerciseId);
        expect(f.overhead).toBe(false);
        expect(f.avoidFor).not.toContain("shoulder");
      }
    }
  });

  it("builds a sensible home-gym session for a beginner with a sore ankle from supported and seated work", () => {
    const home = ["body weight", "dumbbell", "kettlebell", "band"];
    const p = generateSession(LIB, req({ level: "beginner", timeMinutes: 30, equipment: home, context: { injuries: ["ankle"] } }), seeded(2));
    expect(p.exercises.length).toBeGreaterThanOrEqual(3);
    const names = p.exercises.map((e) => e.name);
    expect(names.some((x) => /Squat|Deadlift/.test(x))).toBe(true);
  });
});

describe("over-constrained sessions", () => {
  it("returns a shorter session with an explanation instead of an error", () => {
    const tiny = LIB.filter((e) => ["Bodyweight Squat", "Push Up", "Plank"].includes(e.name));
    const p = generateSession(tiny, req({ timeMinutes: 60 }), seeded(1));
    expect(p.exercises.length).toBeGreaterThan(0);
    expect(p.short).toBe(true);
    expect(p.notes.join(" ")).toMatch(/shorter/);
  });

  it("explains an empty result", () => {
    const p = generateSession([], req(), seeded(1));
    expect(p.exercises).toHaveLength(0);
    expect(p.notes[0]).toMatch(/No exercises fit/);
  });
});

describe("formats and intents", () => {
  it("builds a six-station circuit from simple movements", () => {
    const p = plan({ format: "circuit", level: "beginner" }, 2);
    expect(p.exercises.length).toBeGreaterThanOrEqual(4);
    for (const e of p.exercises) {
      expect(flagsOf(e.exerciseId).spineLoaded).toBe(false);
      expect(flagsOf(e.exerciseId).grip).toBeLessThanOrEqual(1);
    }
    expect(p.notes.join(" ")).toMatch(/circuit/);
  });

  it("uses a tabata block timing", () => {
    const p = plan({ format: "tabata", level: "intermediate" }, 2);
    expect(p.exercises.every((e) => e.reps.includes("20 sec on"))).toBe(true);
  });

  it("uses fewer sets and a lower effort target on a low-readiness day", () => {
    const normal = plan({ level: "intermediate" }, 7).exercises[0];
    const light = plan({ level: "intermediate", context: { tier: "reduced" } }, 7).exercises[0];
    expect(light.sets).toBeLessThan(normal.sets);
    expect(Number(/RPE (\d)/.exec(light.cue)![1])).toBeLessThan(Number(/RPE (\d)/.exec(normal.cue)![1]));
  });
});

describe("supersets and drop sets", () => {
  it("never supersets a beginner, and pairs the exercises of an intermediate tempo session", () => {
    expect(plan({ level: "beginner", intent: "tempo" }, 1).exercises.every((e) => e.supersetGroup === null)).toBe(true);
    const e = plan({ level: "intermediate", intent: "tempo" }, 1).exercises;
    expect(e[0].supersetGroup).toBe("A");
    expect(e[1].supersetGroup).toBe("A");
  });

  it("only gives drop sets to advanced members, on a non-compound, non-balance exercise", () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(plan({ level: "intermediate" }, seed).exercises.every((e) => e.setType === "standard")).toBe(true);
      for (const e of plan({ level: "advanced", intent: "tempo" }, seed).exercises.filter((x) => x.setType === "dropset")) {
        expect(flagsOf(e.exerciseId).compound).toBe(false);
      }
    }
  });
});

describe("weights", () => {
  it("suggests a starting weight from a 5-rep best, with the benchmark lift highest and variations lower", () => {
    const b = { squat5rmKg: 100, deadlift5rmKg: 120, bench5rmKg: 80 };
    const back = suggestWeight("Barbell Back Squat", "barbell", b, 5, 8);
    const goblet = suggestWeight("Goblet Squat", "kettlebell", b, 10, 7);
    expect(back).toMatch(/^~\d/);
    expect(parseFloat(back!.slice(1))).toBeGreaterThan(80);
    expect(parseFloat(back!.slice(1))).toBeLessThan(115);
    expect(parseFloat(goblet!.slice(1))).toBeLessThan(parseFloat(back!.slice(1)));
    expect(suggestWeight("Dumbbell Bench Press", "dumbbell", b, 8, 8)).toMatch(/kg each/);
  });

  it("gives no weight without a benchmark or for exercises it has no ratio for", () => {
    expect(suggestWeight("Barbell Back Squat", "barbell", null, 5, 8)).toBeNull();
    expect(suggestWeight("Cable Lateral Raise", "cable", { squat5rmKg: 100 }, 12, 7)).toBeNull();
  });

  it("puts the estimate on the exercise when benchmarks are given", () => {
    const p = plan({ level: "intermediate", equipment: ["barbell"], context: { benchmarks: { squat5rmKg: 100, deadlift5rmKg: 120, bench5rmKg: 80 } } }, 3);
    expect(p.exercises.some((e) => e.weight)).toBe(true);
  });
});
