import type { Color } from "@/constants/theme";
import type { FoodSubmissionStatus } from "@/lib/queries/food-catalog";

// Single source of truth for submission status label/color/detail copy —
// used by both my-foods.tsx (a compact badge) and submit-food.tsx (the full
// status card). Previously duplicated across both files with drift risk
// (e.g. "In review" vs "Pending review").
export const SUBMISSION_STATUS_COPY: Record<FoodSubmissionStatus, { label: string; color: keyof typeof Color; detail: string }> = {
  pending_review: {
    label: "In review",
    color: "warning",
    detail: "Our team is checking this before it goes public. Usually quick.",
  },
  approved: {
    label: "Approved",
    color: "success",
    detail: "Approved — queued to publish to Open Food Facts.",
  },
  rejected: {
    label: "Not approved",
    color: "danger",
    detail: "This wasn't approved for public sharing. You can edit the food and resubmit.",
  },
  submitted_to_open_food_facts: {
    label: "Published",
    color: "success",
    detail: "This food is now public on Open Food Facts — thanks for contributing!",
  },
  failed: {
    label: "Publish failed",
    color: "danger",
    detail: "Approved, but publishing hit a snag. You can resubmit.",
  },
};
