// Platform-neutral shapes for the Android Google Play App Subscription purchase flow.
//
// Nothing in src/lib/billing/ (except the files named *-native or use-*) imports React Native, Expo or the
// network, so the whole flow is unit-testable with plain objects. The server contract these types mirror is
// docs/google-play-server-contract-2026-10.md in the gym-app repo. Failure handling branches on the server's
// stable `code`, never on its message.

// ── Server API ──────────────────────────────────────────────────────────────

export interface ApiFailure {
  ok: false;
  /** HTTP status, or 0 when the server could not be reached. */
  status: number;
  /** The server's stable machine-readable code, when it sent one. */
  code: string | null;
  /** Safe, user-presentable text from the server. Never branch on it. */
  message: string;
}

export type PurchaseContextResult = { ok: true; obfuscatedAccountId: string } | ApiFailure;

export interface VerifiedPurchase {
  tier: string;
  status: string;
  acknowledged: boolean;
}

export type VerifyResult = ({ ok: true } & VerifiedPurchase) | ApiFailure;

export interface BillingApi {
  /** GET /api/mobile/billing/google-play/purchase-context */
  getPurchaseContext(): Promise<PurchaseContextResult>;
  /** POST /api/mobile/billing/google-play/verify. The server never trusts anything else the client says. */
  verifyPurchase(purchaseToken: string): Promise<VerifyResult>;
}

// ── Store client (Google Play Billing) ─────────────────────────────────────

export type LaunchResult =
  | { kind: "purchased"; purchaseToken: string; productId: string }
  /** The store reports the purchase as pending (slow payment method). No entitlement. */
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "already_owned" }
  | { kind: "error"; code: string };

export interface OwnedPurchase {
  purchaseToken: string;
  productId: string;
}

export interface LaunchArgs {
  productId: string;
  basePlanId: string;
  /** The one-way binding from the server. Passed to the store UNCHANGED, before the purchase starts. */
  obfuscatedAccountId: string;
}

export interface BillingClient {
  /** False off Android, or when the native billing module is not present in this build. */
  isAvailable(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  launchSubscription(args: LaunchArgs): Promise<LaunchResult>;
  /** Purchases the store says this Google account owns. For restore. */
  getOwnedPurchases(): Promise<OwnedPurchase[]>;
  /**
   * Tells the store the purchase is finished. Called ONLY after the server has verified it. The server
   * acknowledges the purchase itself, so this is housekeeping and must tolerate "already acknowledged".
   */
  finishVerified(purchaseToken: string): Promise<void>;
}

/** Keeps a purchased-but-unverified token across an app restart so verification can be retried. */
export interface PendingPurchaseStore {
  load(): Promise<string | null>;
  save(purchaseToken: string): Promise<void>;
  clear(): Promise<void>;
}

export interface BillingDeps {
  client: BillingClient;
  api: BillingApi;
  store: PendingPurchaseStore;
}

// ── Outcomes ────────────────────────────────────────────────────────────────

export type UnavailableReason = "platform_or_library" | "disabled" | "not_configured";

export type BlockedCode = "membership_active" | "play_billing_active";

export type RejectedCode =
  | "owned_by_other"
  | "binding_required"
  | "product_unknown"
  | "provider_rejected"
  | "invalid_request"
  | "not_set_up"
  | "product_mismatch"
  | "unknown";

export type BillingOutcome =
  | { kind: "unavailable"; reason: UnavailableReason }
  /** The account cannot take a purchase right now (an active gym Membership, or a live Play subscription). */
  | { kind: "blocked"; code: BlockedCode; message: string }
  | { kind: "cancelled" }
  /** Pending at the store or at the server. No entitlement yet; it arrives by server notification. */
  | { kind: "pending"; where: "store" | "server" }
  | { kind: "verified"; purchase: VerifiedPurchase }
  /** The purchase happened but the server could not be reached or confirmed. The token is kept for retry. */
  | { kind: "needs_retry"; reason: "server_unreachable" | "server_unavailable" }
  | { kind: "rejected"; code: RejectedCode; message: string }
  | { kind: "nothing_to_restore" }
  | { kind: "error"; message: string };
