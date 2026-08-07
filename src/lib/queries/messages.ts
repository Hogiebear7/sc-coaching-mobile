import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiFetchText } from "@/lib/api-client";

// Mirrors MessagesData in the main repo's lib/messages-data.ts.
export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  senderRole: "member" | "staff";
  body: string;
  createdAt: string;
}

export interface CoachingContextDisplay {
  readinessScore: number | null;
  readinessDelta: number | null;
  loadBand: "low" | "moderate" | "high";
  loadBandLabel: string;
  sessionCount: number;
  tierLabel: string;
}

export interface MessagesData {
  aiMessages: AiMessage[];
  coachMessages: CoachMessage[];
  aiConfigured: boolean;
  aiContext: CoachingContextDisplay | null;
}

interface MessagesResponse {
  success: true;
  data: MessagesData;
}

export function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: () => apiFetch<MessagesResponse>("/api/mobile/messages").then((r) => r.data),
  });
}

export function useSendAiCoachMessage() {
  return useMutation({
    mutationFn: (content: string) => apiFetchText("/api/ai/chat", { body: { content } }),
  });
}

export function useSendCoachMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ success: true; message: string }>("/api/messages/send", {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
