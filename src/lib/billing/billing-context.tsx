import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/queries/profile";
import { CAN_SELL_DIGITAL_PLAN } from "@/lib/upsell-config";

import { createBillingApi } from "./api";
import { BillingController, type BillingSnapshot } from "./controller";
import { createExpoIapBilling } from "./expo-iap-billing";

// Mounts the purchase controller once per signed-in account, so a purchase that completes while the member is anywhere in the app (Ask to Buy approved
// hours later, a purchase left unfinished by a crash) is still settled with the server. A different account always gets a fresh controller: nothing carries
// over between accounts on one phone. Absent entirely when the build does not sell the digital plan (see src/lib/upsell-config.ts).

const BillingContext = createContext<BillingController | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const isMember = status === "signedIn" && user?.role === "member";
  const userId = isMember ? user.id : null;

  const controller = useMemo(
    () =>
      CAN_SELL_DIGITAL_PLAN && userId
        ? new BillingController({
            billing: createExpoIapBilling(),
            api: createBillingApi(),
            // The server just accepted a purchase: re-read what the member is allowed to do, from the server.
            onAccessMayHaveChanged: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
          })
        : null,
    [userId, queryClient]
  );

  useEffect(() => {
    if (!controller) return;
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  // Quiet recovery of a purchase that was paid for but never delivered. Bounded: once per session, only when the member has no digital access.
  const { data: profile } = useProfile({ enabled: !!controller });
  useEffect(() => {
    // Never on a server that did not confirm the member's access with the new rules: it could not verify a purchase either.
    if (controller && profile?.accessSupported) void controller.recover(profile.memberAccess.digital);
  }, [controller, profile]);

  return <BillingContext.Provider value={controller}>{children}</BillingContext.Provider>;
}

/** The controller, or null when this build does not sell the plan or nobody is signed in as a member. */
export function useBillingController(): BillingController | null {
  return useContext(BillingContext);
}

const NOOP_SUBSCRIBE = () => () => {};
const EMPTY: BillingSnapshot = { phase: "idle", plans: [], message: null, retryable: false, unavailableReason: null, verified: null, unsettledCount: 0, restoreMessage: null };

export function useBillingSnapshot(controller: BillingController | null): BillingSnapshot {
  return useSyncExternalStore(controller ? controller.subscribe : NOOP_SUBSCRIBE, controller ? controller.snapshot : () => EMPTY, () => EMPTY);
}
