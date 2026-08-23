import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

// Mirrors ReceiptLineItem in the main repo's lib/ai.ts. Transient — this is
// what the member reviews/edits on-device before anything is used for meal
// suggestions; nothing here is persisted server-side.
export interface ReceiptLineItem {
  rawText: string;
  normalizedName: string;
  isFood: boolean;
  confidence: "confident" | "uncertain";
  quantity: number | null;
  unit: string | null;
}

interface ReceiptScanResponse {
  success: true;
  configured: true;
  items: ReceiptLineItem[];
}

export function useReceiptScan() {
  return useMutation({
    mutationFn: (imageBase64: string) =>
      apiFetch<ReceiptScanResponse>("/api/mobile/nutrition/receipt-scan", {
        method: "POST",
        body: { imageBase64 },
      }),
  });
}
