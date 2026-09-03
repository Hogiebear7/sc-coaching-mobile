import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { WorkoutSetType } from "@/lib/queries/workouts";

// Mirrors ProgramDayType/PrescribedSet/PrescribedExercise/ProgramDayRecord/
// TrainingProgramRecord in the main repo's lib/db.ts.
export type ProgramDayType = "workout" | "rest";
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

export type TrainingProgramSource = "staff" | "ai";

export interface ProgrammeAiMeta {
  goal: string;
  splitStyle: string;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentSlugs: string[];
  gymProfileId: string | null;
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
  weeks: 4 | 8 | 12;
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentSlugs: string[];
  gymProfileId: string | null;
}

export interface ProgrammePreview {
  name: string;
  days: ProgramDay[];
  totalWeeks: number;
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
