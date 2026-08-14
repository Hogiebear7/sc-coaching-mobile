// Lightweight, pluggable analytics for the food-logging/submission flow.
// No analytics vendor (PostHog/Amplitude/Segment/etc.) is wired up anywhere
// in this app yet, so this establishes the pattern rather than following an
// existing one — deliberately mirroring the same "real interface, honest
// unconfigured default, single swap point" shape already used for
// lib/open-food-facts-client.ts's write provider on the backend. Swapping in
// a real vendor later means implementing AnalyticsProvider and replacing the
// `analyticsProvider` export below — every call site (trackEvent) stays the
// same.

export type FoodAnalyticsEvent =
  | "food_search_started"
  | "food_search_result_selected"
  | "barcode_scan_started"
  | "barcode_scan_found"
  | "barcode_scan_not_found"
  | "barcode_scan_error"
  | "barcode_scan_camera_unavailable"
  | "label_scan_started"
  | "label_scan_items_identified"
  | "label_scan_manual_fallback"
  | "label_scan_camera_unavailable"
  | "custom_food_created"
  | "food_submission_started"
  | "food_submission_eligible"
  | "food_submission_sent"
  | "food_submission_rejected"
  | "food_submission_camera_unavailable"
  | "meal_suggest_requested"
  | "meal_suggest_logged"
  | "meal_suggest_camera_unavailable";

export interface AnalyticsProvider {
  readonly configured: boolean;
  track(event: FoodAnalyticsEvent, properties?: Record<string, unknown>): void;
}

const consoleAnalyticsProvider: AnalyticsProvider = {
  configured: false,
  track(event, properties) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] ${event}`, properties ?? {});
    }
  },
};

// Swap this export for a real provider once a vendor is chosen.
export const analyticsProvider: AnalyticsProvider = consoleAnalyticsProvider;

// Never let instrumentation break the flow it's observing.
export function trackEvent(event: FoodAnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    analyticsProvider.track(event, properties);
  } catch {
    // swallow — see above
  }
}
