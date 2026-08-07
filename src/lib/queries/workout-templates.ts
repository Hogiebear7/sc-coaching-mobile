import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { PrescribedExercise } from "@/lib/queries/programs";

// Mirrors WorkoutTemplateRecord in the main repo's lib/db.ts.
export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: PrescribedExercise[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkoutTemplatesResponse {
  success: true;
  data: WorkoutTemplate[];
}

export function useWorkoutTemplates() {
  return useQuery({
    queryKey: ["workout-templates"],
    queryFn: () => apiFetch<WorkoutTemplatesResponse>("/api/mobile/workout-templates").then((r) => r.data),
  });
}

export interface WorkoutTemplateInput {
  name: string;
  exercises: PrescribedExercise[];
}

export function useCreateWorkoutTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutTemplateInput) =>
      apiFetch<{ success: true; data: WorkoutTemplate }>("/api/mobile/workout-templates/create", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates"] }),
  });
}

export function useUpdateWorkoutTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutTemplateInput & { id: string; archived?: boolean }) =>
      apiFetch<{ success: true; data: WorkoutTemplate }>("/api/mobile/workout-templates/update", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates"] }),
  });
}

export function useDeleteWorkoutTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>("/api/mobile/workout-templates/delete", { method: "POST", body: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-templates"] }),
  });
}
