import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth-context";

import { APP_SUBSCRIPTION_PRODUCT_ID, billingApi, getBillingClient, isAppSubscriptionPurchaseConfigured } from "./index";
import { createPendingPurchaseStore } from "./pending-purchase-store";
import { resumePendingPurchase, restorePurchases, runPurchase } from "./purchase-flow";
import type { BillingDeps, BillingOutcome } from "./types";

// React wiring for the App Subscription purchase flow. All the rules live in ./purchase-flow (pure, tested). This hook
// only owns UI state, refreshes entitlement-dependent queries after a verified purchase, and retries a paid-but-
// unconfirmed purchase when the app starts and when it returns to the foreground.
export function useAppSubscriptionPurchase() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<BillingOutcome | null>(null);
  const inFlight = useRef(false);

  const deps: BillingDeps | null = useMemo(
    () => (user ? { client: getBillingClient(), api: billingApi, store: createPendingPurchaseStore(user.id) } : null),
    [user]
  );

  const settle = useCallback(
    (result: BillingOutcome) => {
      setOutcome(result);
      // The server wrote the entitlement before it answered, so refresh everything that depends on the member's tier.
      if (result.kind === "verified") void queryClient.invalidateQueries();
    },
    [queryClient]
  );

  // One operation at a time: a double tap must never start two purchases.
  const guarded = useCallback(
    async (work: () => Promise<BillingOutcome | null>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await work();
        if (result) settle(result);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [settle]
  );

  const purchase = useCallback(
    (basePlanId: string) => {
      if (!deps) return Promise.resolve();
      return guarded(() => runPurchase(deps, { productId: APP_SUBSCRIPTION_PRODUCT_ID, basePlanId }));
    },
    [deps, guarded]
  );

  const restore = useCallback(() => {
    if (!deps) return Promise.resolve();
    return guarded(() => restorePurchases(deps, APP_SUBSCRIPTION_PRODUCT_ID));
  }, [deps, guarded]);

  // Retry a paid-but-unconfirmed purchase on mount and whenever the app returns to the foreground.
  useEffect(() => {
    if (!deps || !isAppSubscriptionPurchaseConfigured()) return;
    void guarded(() => resumePendingPurchase(deps));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void guarded(() => resumePendingPurchase(deps));
    });
    return () => sub.remove();
  }, [deps, guarded]);

  return { available: isAppSubscriptionPurchaseConfigured(), busy, outcome, purchase, restore, dismiss: () => setOutcome(null) };
}
