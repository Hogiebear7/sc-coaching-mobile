// Tiny in-memory (not persisted) handoff for a label photo captured during
// the label-scan flow, so a food saved from that flow can offer the same
// photo again if the member chooses to share it publicly shortly after —
// without asking them to capture it twice. Session-only by design: there's
// no backend field for a "draft" photo pre-save, and persisting it further
// than the current app session isn't worth the complexity for a convenience
// prefill.
const draftLabelPhotos = new Map<string, string>();

export function setDraftLabelPhoto(customFoodId: string, dataUrl: string): void {
  draftLabelPhotos.set(customFoodId, dataUrl);
}

export function getDraftLabelPhoto(customFoodId: string): string | null {
  return draftLabelPhotos.get(customFoodId) ?? null;
}

export function clearDraftLabelPhoto(customFoodId: string): void {
  draftLabelPhotos.delete(customFoodId);
}
