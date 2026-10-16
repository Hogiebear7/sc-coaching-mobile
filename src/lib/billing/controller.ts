// The purchase lifecycle of the App Subscription, with no React and no native code in it: a state machine over a StoreBilling and a BillingApi.
//
// Rules this file exists to keep (each has a test in __tests__/controller.test.ts):
//
//  1. The server is the authority. Nothing the store or this app says about a purchase grants anything: access appears only when the SERVER's verify answers
//     success, and the app then re-reads the member's access from the server.
//  2. A purchase is finished with the store only AFTER the server accepted it. Until then it stays unfinished, so the store keeps handing it back and a closed
//     app, a lost connection or a server error never loses a purchase a member paid for.
//  3. A purchase the server REFUSES (another account owns it, the binding does not match ...) is never finished and never retried in a loop: the member is told
//     plainly, and it is left for support. Only transient problems (no connection, the store unreachable, still processing) are retried.
//  4. The account binding is fetched from the server for the SIGNED-IN account immediately before a purchase and carried on it, so a purchase can only ever be
//     claimed by the account that started it.
//  5. Restore asks the store what it holds and offers each purchase to the server, which decides. "Nothing to restore" and "that belongs to another account" are
//     different, honest answers. Restoring never changes anything by itself.
//  6. Recovery at launch is quiet and bounded: once per session, only when the member has no digital access, and it never nags about a refusal.

import { isAlreadyActiveCode, isRetryableServerCode, messageForServerCode, TRIALS_UNAVAILABLE_MESSAGE } from "./copy";
import {
  BillingError,
  ServerBillingError,
  type BillingApi,
  type CatalogPlan,
  type PurchaseProof,
  type StoreBilling,
  type StorePlan,
  type VerifyResult,
} from "./types";

export type BillingPhase =
  | "idle"
  | "loading"
  | "unavailable" // billing or products cannot be used here; see `unavailableReason`
  | "ready" // plans are loaded and can be bought
  | "purchasing" // the store's purchase sheet is up
  | "verifying" // the store said yes; the server is checking
  | "success"
  | "pending" // the store is holding the purchase (Ask to Buy, slow payment)
  | "failed"; // see `message`

export type UnavailableReason = "no_billing" | "no_products" | "server" | "offline";

export interface BillingSnapshot {
  phase: BillingPhase;
  plans: StorePlan[];
  message: string | null;
  /** True when trying again may work. */
  retryable: boolean;
  unavailableReason: UnavailableReason | null;
  /** The last successful verification, for the UI to show what changed. */
  verified: VerifyResult | null;
  /** Purchases the store holds that the server has not accepted yet (transient failures). They are retried, never dropped. */
  unsettledCount: number;
  /** A one-line outcome of the last Restore, or null. */
  restoreMessage: string | null;
}

export interface ControllerOptions {
  billing: StoreBilling;
  api: BillingApi;
  /** Called after the server accepted a purchase, so the app can re-read the member's access. */
  onAccessMayHaveChanged?: () => void;
}

const INITIAL: BillingSnapshot = { phase: "idle", plans: [], message: null, retryable: false, unavailableReason: null, verified: null, unsettledCount: 0, restoreMessage: null };

type Outcome = "accepted" | "transient" | "refused";

export class BillingController {
  private readonly billing: StoreBilling;
  private readonly api: BillingApi;
  private readonly onAccessMayHaveChanged: () => void;
  private state: BillingSnapshot = { ...INITIAL };
  private listeners = new Set<() => void>();
  private catalog: CatalogPlan[] = [];
  private unsettled = new Map<string, PurchaseProof>();
  private inFlight = new Map<string, Promise<Outcome>>();
  private pendingWork = new Set<Promise<unknown>>();
  private unsubscribe: (() => void)[] = [];
  private recovered = false;
  private started = false;
  /** True while the paywall is on screen: purchase results then drive the screen. Otherwise settling is quiet. */
  private interactive = false;

  constructor(options: ControllerOptions) {
    this.billing = options.billing;
    this.api = options.api;
    this.onAccessMayHaveChanged = options.onAccessMayHaveChanged ?? (() => {});
  }

  get platform() {
    return this.billing.platform;
  }

  /** Opens the store's own subscription management (where a member cancels or changes payment). The app never cancels anything itself. */
  async manage(productId?: string): Promise<void> {
    try {
      await this.billing.connect();
      await this.billing.openManagement(productId ? { productId } : undefined);
    } catch {
      // The store's page could not be opened; the paywall's own text already says where to manage it.
    }
  }

  // ── Observation ──────────────────────────────────────────────────────────────────────────────────────

  snapshot = (): BillingSnapshot => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<BillingSnapshot>) {
    this.state = { ...this.state, ...patch, unsettledCount: this.unsettled.size };
    for (const l of this.listeners) l();
  }

  /** Resolves when every purchase currently being settled has finished. For tests and for screens that must wait. */
  async settled(): Promise<void> {
    while (this.pendingWork.size > 0) await Promise.allSettled([...this.pendingWork]);
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.pendingWork.add(work);
    work.finally(() => this.pendingWork.delete(work)).catch(() => {});
    return work;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────────────────────────────

  /** Connects, listens for purchases, and loads the plans. Safe to call again to retry. */
  async load(): Promise<void> {
    this.interactive = true;
    this.ensureStarted();
    this.set({ phase: "loading", message: null, retryable: false, unavailableReason: null });

    let connected = false;
    try {
      connected = await this.billing.connect();
    } catch {
      connected = false;
    }
    if (!connected) {
      this.set({ phase: "unavailable", plans: [], unavailableReason: "no_billing", message: "Subscriptions can't be bought on this device right now.", retryable: true });
      return;
    }

    try {
      this.catalog = await this.api.getCatalog();
    } catch (error) {
      const offline = error instanceof ServerBillingError && error.status === 0;
      this.set({
        phase: "unavailable",
        plans: [],
        unavailableReason: offline ? "offline" : "server",
        message: offline ? "Can't reach the server. Check your connection and try again." : "Subscriptions aren't available right now. Please try again later.",
        retryable: true,
      });
      return;
    }

    let plans: StorePlan[] = [];
    try {
      plans = await this.billing.loadPlans(this.catalog);
    } catch {
      plans = [];
    }
    if (plans.length === 0) {
      this.set({ phase: "unavailable", plans: [], unavailableReason: "no_products", message: "Subscriptions aren't available right now. Please try again later.", retryable: true });
      return;
    }
    this.set({ phase: "ready", plans, message: null, retryable: false, unavailableReason: null });
  }

  private ensureStarted() {
    if (this.started) return;
    this.started = true;
    this.unsubscribe.push(this.billing.onPurchase((proof) => void this.track(this.settle(proof, { quiet: !this.interactive }))));
    this.unsubscribe.push(
      this.billing.onError((error) => {
        if (this.interactive) this.handleStoreError(error);
      })
    );
  }

  /** The paywall left the screen: results stop driving it, but purchases are still settled with the server. */
  leave() {
    this.interactive = false;
  }

  async dispose(): Promise<void> {
    for (const u of this.unsubscribe) u();
    this.unsubscribe = [];
    this.started = false;
    this.listeners.clear();
    try {
      await this.billing.disconnect();
    } catch {
      // nothing to do: the connection is being dropped anyway
    }
  }

  // ── Buying ───────────────────────────────────────────────────────────────────────────────────────────

  async buy(plan: StorePlan, options: { withoutTrial?: boolean } = {}): Promise<void> {
    if (this.state.phase === "purchasing" || this.state.phase === "verifying") return;
    this.set({ message: null, retryable: false });

    // A plan the store would start a trial on while the server cannot honour one is never bought as it stands: iOS would apply the offer on its own, and nothing is
    // silently turned into a paid purchase. Only Android, and only when the member explicitly chose "without a free trial", may buy the regular offer.
    if (plan.trialBlocked && !(this.billing.platform === "android" && options.withoutTrial)) {
      this.set({ message: TRIALS_UNAVAILABLE_MESSAGE, retryable: false });
      return;
    }

    let binding;
    try {
      // Starting a trial: the server claims its AI capacity BEFORE the store sheet opens. A paid purchase (no trial) claims nothing.
      binding = await this.api.getBinding(this.billing.platform, { trial: !!plan.trial });
    } catch (error) {
      if (error instanceof ServerBillingError && error.code === "trial_unavailable") {
        // No capacity: nothing opens, nothing is bought. Refresh the plans (the catalog now says the trial is unavailable) and tell the member plainly.
        await this.load();
        this.set({ phase: this.state.plans.length ? "ready" : this.state.phase, message: TRIALS_UNAVAILABLE_MESSAGE, retryable: false });
        return;
      }
      const failure = this.describeServerFailure(error);
      // The server refuses to start a second purchase for an account that already has one: say so, do not open the sheet.
      this.set({ phase: failure.alreadyActive ? "ready" : "failed", message: failure.message, retryable: failure.retryable });
      return;
    }

    this.set({ phase: "purchasing" });
    try {
      await this.billing.startPurchase(plan, binding);
    } catch (error) {
      this.handleStoreError(error instanceof BillingError ? error : new BillingError("unknown"));
    }
  }

  private handleStoreError(error: BillingError) {
    switch (error.code) {
      case "cancelled":
        this.set({ phase: this.state.plans.length ? "ready" : "idle", message: null, retryable: false });
        return;
      case "pending":
        this.set({ phase: "pending", message: "Your purchase is waiting for approval or payment. We'll turn on your access as soon as the store confirms it.", retryable: false });
        return;
      case "already_owned":
        this.set({ phase: "ready", message: "The store says this account already has the App Subscription. Tap Restore purchases to reconnect it to your S&C account.", retryable: false });
        return;
      case "unavailable":
      case "product_unavailable":
        this.set({ phase: "unavailable", unavailableReason: "no_products", message: "Subscriptions aren't available right now. You haven't been charged. Please try again later.", retryable: true });
        return;
      case "network":
        this.set({ phase: "failed", message: "Can't reach the store. Check your connection and try again. You haven't been charged.", retryable: true });
        return;
      default:
        this.set({ phase: "failed", message: "The purchase didn't go through. You haven't been charged. Please try again.", retryable: true });
    }
  }

  // ── Settling a purchase the store handed us ─────────────────────────────────────────────────────────

  private describeServerFailure(error: unknown): { code: string | null; message: string; retryable: boolean; alreadyActive: boolean } {
    if (error instanceof ServerBillingError) {
      return { code: error.code, message: messageForServerCode(error.code ?? (error.status === 0 ? "provider_unavailable" : null)), retryable: isRetryableServerCode(error.code, error.status), alreadyActive: isAlreadyActiveCode(error.code) };
    }
    return { code: null, message: messageForServerCode(null), retryable: false, alreadyActive: false };
  }

  private settle(proof: PurchaseProof, options: { quiet: boolean }): Promise<Outcome> {
    const existing = this.inFlight.get(proof.key);
    if (existing) return existing;
    const work = this.settleOnce(proof, options).finally(() => this.inFlight.delete(proof.key));
    this.inFlight.set(proof.key, work);
    return work;
  }

  private async settleOnce(proof: PurchaseProof, options: { quiet: boolean }): Promise<Outcome> {
    if (!options.quiet) this.set({ phase: "verifying", message: null, retryable: false });

    let verified: VerifyResult;
    try {
      verified = await this.api.verify(proof);
    } catch (error) {
      const failure = this.describeServerFailure(error);

      // The account already has this plan (a duplicate delivery of something already settled): that is success, and the transaction is safe to finish.
      if (failure.alreadyActive) {
        await this.finishQuietly(proof);
        this.unsettled.delete(proof.key);
        if (!options.quiet) this.set({ phase: "ready", message: failure.message });
        this.onAccessMayHaveChanged();
        return "accepted";
      }

      if (failure.retryable) {
        // Transient: keep the purchase, do NOT finish it, and say it is safe. It is retried on the next load, Restore or launch recovery.
        this.unsettled.set(proof.key, proof);
        if (!options.quiet) this.set({ phase: "failed", message: failure.message, retryable: true });
        else this.set({});
        return "transient";
      }

      // Refused for a reason retrying cannot fix. Never finished, never looped.
      this.unsettled.delete(proof.key);
      if (!options.quiet) this.set({ phase: "failed", message: failure.message, retryable: false });
      return "refused";
    }

    // The server accepted it. Only now is the store told the purchase was delivered.
    await this.finishQuietly(proof);
    this.unsettled.delete(proof.key);
    this.set({ phase: options.quiet ? this.state.phase : "success", verified, message: null, retryable: false });
    this.onAccessMayHaveChanged();
    return "accepted";
  }

  private async finishQuietly(proof: PurchaseProof): Promise<void> {
    try {
      await this.billing.finish(proof);
    } catch {
      // The server already has the purchase and is the authority. A finish that fails is retried by the store the next time it hands the
      // transaction back, and the server treats the repeat as a duplicate of the same account.
    }
  }

  /** Re-offers purchases kept after a transient failure. Never touches ones the server refused. */
  async retryUnsettled(): Promise<void> {
    await this.track(Promise.all([...this.unsettled.values()].map((p) => this.settle(p, { quiet: false }))));
  }

  // ── Restore and recovery ──────────────────────────────────────────────────────────────────────────

  async restore(): Promise<void> {
    this.set({ phase: "verifying", message: null, retryable: false, restoreMessage: null });
    let owned: PurchaseProof[];
    try {
      owned = await this.billing.getOwned(this.catalog);
    } catch {
      this.set({ phase: this.state.plans.length ? "ready" : "failed", message: "Couldn't check the store for purchases. Try again.", retryable: true });
      return;
    }
    if (owned.length === 0) {
      this.set({ phase: this.state.plans.length ? "ready" : "idle", restoreMessage: "No App Subscription purchases were found for this store account." });
      return;
    }

    const outcomes = await this.track(Promise.all(owned.map((p) => this.settle(p, { quiet: true }))));
    const accepted = outcomes.filter((o) => o === "accepted").length;
    const transient = outcomes.filter((o) => o === "transient").length;
    const refused = outcomes.filter((o) => o === "refused").length;

    let restoreMessage: string;
    if (accepted > 0) restoreMessage = "Your App Subscription has been restored.";
    else if (transient > 0) restoreMessage = "We found your purchase but couldn't reach the server to restore it. Try again in a moment.";
    else if (refused > 0) restoreMessage = "We found a purchase, but it belongs to a different S&C account. Sign in to the account you bought it with.";
    else restoreMessage = "Nothing was restored.";

    this.set({ phase: this.state.plans.length ? "ready" : "idle", restoreMessage, retryable: transient > 0 });
  }

  /**
   * Quiet, once-per-session recovery for a purchase that was paid for but never delivered (the app closed, the server was down). Runs only when the member
   * has no digital access, never shows an error, and never retries a refusal.
   */
  async recover(hasDigitalAccess: boolean): Promise<void> {
    if (this.recovered || hasDigitalAccess) return;
    this.recovered = true;
    try {
      this.ensureStarted();
      if (!(await this.billing.connect())) return;
      if (this.catalog.length === 0) this.catalog = await this.api.getCatalog();
      const owned = await this.billing.getOwned(this.catalog);
      await this.track(Promise.all(owned.map((p) => this.settle(p, { quiet: true }))));
    } catch {
      // Quiet by design: Restore purchases is the member's own way to try again.
    }
  }
}
