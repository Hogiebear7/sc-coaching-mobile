import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { TrainingDayOfWeek } from "@/lib/queries/weekly-training";
import type { WorkoutSetType } from "@/lib/queries/workouts";

// Mirrors ProgramDayType/PrescribedSet/PrescribedExercise/ProgramDayRecord/
// TrainingProgramRecord in the main repo's lib/db.ts.
export type ProgramDayType = "workout" | "rest" | "test";
export type TrainingProgramStatus = "active" | "archived";

export interface PrescribedSet {
  reps: string | null;
  weight: string | null;
  setType: WorkoutSetType | null;
}

export interface PrescribedExercise {
  id: string;
  exerciseId: string | null;
  name: string;
  muscleTags: string[];
  targetSets: number | null;
  targetReps: string | null;
  targetWeight: string | null;
  setType: WorkoutSetType | null;
  sets: PrescribedSet[] | null;
  supersetGroup: string | null;
  notes: string | null;
}

export interface ProgramDay {
  id: string;
  label: string;
  type: ProgramDayType;
  exercises: PrescribedExercise[];
}

// A baseline/retest checkpoint — see gym-app's lib/training-programs.ts
// computeCheckpointWeeks. weekNumber is 1-based against totalWeeks, not a
// calendar week.
export interface TestCheckpoint {
  weekNumber: number;
  day: ProgramDay;
}

export interface AdjustmentProposal {
  type: "accelerate" | "hold_back" | "expedite_timeline";
  rationale: string;
  proposedTotalWeeks?: number;
}

// A second, independent proposal from AdjustmentProposal above — offered
// only on a refresh-eligible week (roughly every 4-6 weeks), regardless of
// whether a pace/timeline adjustment is also on offer that cycle.
export interface ExerciseRefreshProposal {
  rationale: string;
}

export interface ProgrammeCheckIn {
  cycleIndex: number;
  generatedAt: string;
  feedbackText: string;
  adjustmentProposal: AdjustmentProposal | null;
  adjustmentDecision: "accepted" | "declined" | null;
  exerciseRefreshProposal: ExerciseRefreshProposal | null;
  exerciseRefreshDecision: "accepted" | "declined" | null;
}

export type TrainingProgramSource = "staff" | "ai";

export interface ProgrammeAiMeta {
  goal: string;
  splitStyle: string;
  /** Why this split/balance fits the goal, and an honest read on how
      demanding it'll feel — undefined for programmes saved before this
      field existed. */
  rationale?: string | null;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentSlugs: string[];
  gymProfileId: string | null;
  /** Free-text detail the member added (upcoming event, a specific PB, a
      show date, etc.) — passed to the AI at generation time and kept here
      so "Regenerate" reuses the same brief. */
  notes: string | null;
  generatedAt: string;
}

export interface TrainingProgram {
  id: string;
  userId: string;
  name: string;
  status: TrainingProgramStatus;
  days: ProgramDay[];
  currentDayIndex: number;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
  source?: TrainingProgramSource;
  totalWeeks?: number | null;
  completedCycles?: number;
  aiMeta?: ProgrammeAiMeta | null;
  testCheckpoints?: TestCheckpoint[];
  progressBias?: "accelerate" | "normal" | "hold_back";
  checkIns?: ProgrammeCheckIn[];
}

export interface StaffTrainingProgramSummary extends TrainingProgram {
  memberEmail: string;
  memberFullName: string | null;
}

interface StaffProgramsResponse {
  success: true;
  data: StaffTrainingProgramSummary[];
}

export function useStaffPrograms(userId: string | undefined) {
  return useQuery({
    queryKey: ["staff-programs", userId],
    queryFn: () =>
      apiFetch<StaffProgramsResponse>(`/api/mobile/staff/programs?userId=${encodeURIComponent(userId ?? "")}`).then(
        (r) => r.data
      ),
    enabled: !!userId,
  });
}

export interface ProgramInput {
  userId: string;
  name: string;
  days: ProgramDay[];
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProgramInput) =>
      apiFetch<{ success: true; data: TrainingProgram }>("/api/mobile/staff/programs/create", {
        method: "POST",
        body: input,
      }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["staff-programs", vars.userId] }),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProgramInput & { id: string; status?: TrainingProgramStatus }) =>
      apiFetch<{ success: true; data: TrainingProgram }>("/api/mobile/staff/programs/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["staff-programs", vars.userId] }),
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; userId: string }) =>
      apiFetch<{ success: true }>("/api/mobile/staff/programs/delete", { method: "POST", body: { id } }),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["staff-programs", vars.userId] }),
  });
}

// Member-facing: the signed-in member's own active program.
interface MyProgramResponse {
  success: true;
  data: { program: TrainingProgram | null };
}

export function useMyProgram() {
  return useQuery({
    queryKey: ["my-program"],
    queryFn: () => apiFetch<MyProgramResponse>("/api/mobile/programs").then((r) => r.data.program),
  });
}

interface MyArchivedProgramsResponse {
  success: true;
  data: TrainingProgram[];
}

export function useMyArchivedPrograms() {
  return useQuery({
    queryKey: ["my-archived-programs"],
    queryFn: () => apiFetch<MyArchivedProgramsResponse>("/api/mobile/programs/archive").then((r) => r.data),
  });
}

export function useAdvanceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MyProgramResponse>("/api/mobile/programs/advance", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-program"] }),
  });
}

// AI programme builder — generate is a preview only (nothing saved, safe to
// re-roll for free); save persists exactly what was previewed. See
// gym-app/app/api/mobile/programs/{generate,save}/route.ts.
export interface GenerateProgrammeInput {
  goal: string;
  // A fixed preset (4/8/12) or a whole-number week count derived from a
  // custom end date (see workout-generator.tsx's weeksUntil) — the backend
  // accepts any integer in a sane range, not just the three presets.
  weeks: number;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentSlugs: string[];
  gymProfileId: string | null;
  notes: string | null;
}

export interface ProgrammePreview {
  name: string;
  days: ProgramDay[];
  totalWeeks: number;
  testCheckpoints: TestCheckpoint[];
  aiMeta: ProgrammeAiMeta;
}

interface GenerateProgrammeResponse {
  success: true;
  configured: true;
  data: ProgrammePreview;
}

export function useGenerateProgramme() {
  return useMutation({
    mutationFn: (input: GenerateProgrammeInput) =>
      apiFetch<GenerateProgrammeResponse>("/api/mobile/programs/generate", { method: "POST", body: input }).then(
        (r) => r.data
      ),
  });
}

export function useSaveProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProgrammePreview) =>
      apiFetch<{ success: true; data: { program: TrainingProgram } }>("/api/mobile/programs/save", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-program"] }),
  });
}

interface CheckInResponse {
  success: true;
  configured: true;
  data: ProgrammeCheckIn;
}

// Lazy-generate-and-cache, same shape as the post-workout review — the
// first open of a given cycle's check-in triggers generation server-side;
// every later open just reads the cached result back.
export function useProgrammeCheckIn(programId: string | undefined, cycleIndex: number | undefined) {
  return useQuery({
    queryKey: ["programme-checkin", programId, cycleIndex],
    queryFn: () =>
      apiFetch<CheckInResponse>(`/api/mobile/programs/${programId}/checkin/${cycleIndex}`).then((r) => r.data),
    enabled: programId !== undefined && cycleIndex !== undefined,
  });
}

export function useApplyProgrammeAdjustment(programId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // kind defaults server-side to "adjustment" when omitted — pass
    // "refresh" to act on exerciseRefreshProposal instead, independently of
    // any pace/timeline adjustmentProposal the same check-in might have.
    mutationFn: (input: { cycleIndex: number; kind?: "adjustment" | "refresh"; decision: "accept" | "decline" }) =>
      apiFetch<{ success: true; data: { program: TrainingProgram } }>(`/api/mobile/programs/${programId}/apply-adjustment`, {
        method: "POST",
        body: input,
      }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["programme-checkin", programId, vars.cycleIndex] });
      qc.invalidateQueries({ queryKey: ["my-program"] });
    },
  });
}

// One weekday (0-6) per type:"workout" day in the programme, in order —
// see gym-app's lib/programme-weekly-sync.ts for how these get expanded
// into real one-off Weekly Training sessions across every week.
export function useSyncProgrammeToWeeklySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; weekdayMap: TrainingDayOfWeek[] }) =>
      apiFetch<{ success: true; message: string }>("/api/mobile/programs/sync-weekly-schedule", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-training"] }),
  });
}
