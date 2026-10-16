// The narrow seam between the app and a store's billing library. Everything above this (the purchase flow, the paywall) talks to a
// StoreBilling and a BillingApi, never to the native library or to fetch directly, so the whole lifecycle is tested here with fakes.
//
// Plain TypeScript, no React Native imports: runs under vitest in Node.

import type { MemberAccess } from "@/lib/member-access";

export type StorePlatform = "ios" | "android";

/** One plan as the SERVER lists it: store product identifiers only. There is no price here and there never is. */
export interface CatalogPlan {
  billingOptionId: string;
  intervalUnit: "month" | "year" | null;
  intervalCount: number | null;
  appStoreProductId: string | null;
  googlePlayProductId: string | null;
  googlePlayBasePlanId: string | null;
  /**
   * The server says whether a NEW free trial can be honoured with its AI allowance right now (its shared trial pool has room). The store, not the server, starts a
   * trial, so this only decides whether the app may PROMISE one. Anything other than true (false, or absent from an older server) means: do not promise a trial.
   */
  trialAvailable?: boolean;
}

/** One plan as the STORE reports it. The price text is the store's own, localised, and is the only price the app ever displays. */
export interface StorePlan {
  billingOptionId: string;
  productId: string;
  title: string;
  /** e.g. "£12.99" exactly as the store formats it. */
  displayPrice: string;
  /** e.g. "per month", "every 6 months", "per year". Derived from the catalog's period, for display grouping only. */
  periodLabel: string;
  intervalUnit: "month" | "year" | null;
  intervalCount: number | null;
  basePlanId: string | null;
  /** Android: the offer token the purchase must carry. */
  offerToken: string | null;
  /**
   * A free trial the STORE says this member is eligible for right now, or null (not offered, already used, or the store could not say). The length is
   * whatever the store returned: it is never assumed to be seven days. `displayPrice` above is always the full price charged AFTER the trial.
   */
  trial: { label: string } | null;
  /**
   * The store offers this member a free trial (iOS applies an introductory offer on its own) but the server says trial AI capacity is unavailable, so the app does
   * not promote the trial and warns that AI is not available during it. Always false on Android, where the app simply buys the plan without the trial offer.
   */
  trialAiUnavailable?: boolean;
}

/** The account binding the server hands out; the purchase must carry it or the server will refuse to claim it. */
export type PurchaseBinding = { platform: "ios"; appAccountToken: string } | { platform: "android"; obfuscatedAccountId: string };

/** What the store gave us for a purchase, in the form the server verifies. */
export interface PurchaseProof {
  platform: StorePlatform;
  productId: string;
  /** iOS: Apple's signed transaction (JWS). */
  signedTransaction?: string;
  /** Android: the purchase token. */
  purchaseToken?: string;
  /** A stable local key for this transaction, to avoid settling the same one twice at once. */
  key: string;
  /** Opaque handle the billing implementation needs to finish the transaction. */
  native: unknown;
}

export type BillingErrorCode =
  | "cancelled" // the member backed out
  | "pending" // the store is holding the purchase (Ask to Buy, slow payment). It completes later through the update listener.
  | "unavailable" // billing is not available on this device or build
  | "product_unavailable" // the store does not offer the product
  | "already_owned" // the store says this account already owns it
  | "network"
  | "unknown";

export class BillingError extends Error {
  code: BillingErrorCode;
  constructor(code: BillingErrorCode, message: string = code) {
    super(message);
    this.code = code;
    this.name = "BillingError";
  }
}

export interface StoreBilling {
  readonly platform: StorePlatform;
  /** Connects to the store. False when billing cannot be used here (no native module, no store service). */
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  /** Asks the store for these catalog plans. Only plans the store actually returns come back. */
  loadPlans(catalog: CatalogPlan[]): Promise<StorePlan[]>;
  /** Starts the store's purchase sheet. Resolves when the sheet is up; the outcome arrives through onPurchase / onError. */
  startPurchase(plan: StorePlan, binding: PurchaseBinding): Promise<void>;
  /** Purchases the store still holds for this account that belong to the digital plan (for restore and recovery). */
  getOwned(catalog: CatalogPlan[]): Promise<PurchaseProof[]>;
  /** Tells the store the app has delivered the purchase (StoreKit finish). A no-op on Android: the server acknowledges. */
  finish(proof: PurchaseProof): Promise<void>;
  /** Opens the store's own subscription management for this account. */
  openManagement(plan?: { productId: string }): Promise<void>;
  /** A purchase arrived (a new one, a delayed one, or one left unfinished from before). */
  onPurchase(listener: (proof: PurchaseProof) => void): () => void;
  /** A purchase failed or was cancelled. */
  onError(listener: (error: BillingError) => void): () => void;
}

/** The server's refusal, with its stable code. */
export class ServerBillingError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ServerBillingError";
  }
}

export interface DigitalPlanSummary {
  source: "google_play" | "app_store" | "staff_grant";
  status: string;
  currentPeriodEnd: string | null;
  autoRenewing: boolean;
  /** The current period is a free trial. */
  trial?: boolean;
  environment: "production" | "sandbox" | null;
}

export interface VerifyResult {
  access: MemberAccess;
  plan: DigitalPlanSummary | null;
  status: string;
}

export interface BillingApi {
  getCatalog(): Promise<CatalogPlan[]>;
  getBinding(platform: StorePlatform): Promise<PurchaseBinding>;
  /** Throws ServerBillingError with the server's code when the server refuses. */
  verify(proof: PurchaseProof): Promise<VerifyResult>;
}
