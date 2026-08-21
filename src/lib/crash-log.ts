import AsyncStorage from "@react-native-async-storage/async-storage";

// Diagnostic-only crash capture — there's no Sentry/Crashlytics wired into
// this app, so a fatal JS error in a release build otherwise leaves no
// trace at all (no red-box, no log anyone can retrieve). This persists the
// error to disk from RN's global error handler so it can be shown back to
// the member on next launch, screenshotted, and sent to the dev — the only
// way to get a real stack trace out of a production crash right now.
const KEY = "last-crash-v1";
// Deliberately separate from KEY — unhandled rejections are normally
// non-fatal (the app keeps running), so a rejection must never end up in
// the fatal-crash slot the CrashViewer reads: that would show "the app
// crashed last time" on a completely healthy next launch.
const REJECTION_KEY = "last-rejection-v1";

export interface CrashRecord {
  message: string;
  stack?: string;
  isFatal: boolean;
  timestamp: number;
}

export async function getLastCrash(): Promise<CrashRecord | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrashRecord;
  } catch {
    return null;
  }
}

export async function clearLastCrash(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// Diagnostic only — not surfaced in the UI. A rejection alone can't
// explain a hard crash (RN release builds don't crash on these), but if
// one happened moments before an unrelated native-level crash, having it
// on record helps rule the theory in or out without guessing blind.
export async function getLastRejection(): Promise<CrashRecord | null> {
  const raw = await AsyncStorage.getItem(REJECTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrashRecord;
  } catch {
    return null;
  }
}

interface RNErrorUtils {
  setGlobalHandler: (fn: (error: Error, isFatal?: boolean) => void) => void;
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
}

function persistRecord(key: string, record: CrashRecord, onDone: () => void) {
  // AsyncStorage writes are async over the bridge — the app may terminate
  // before the promise resolves, so this is best-effort, not guaranteed.
  // The 300ms fallback ensures we never delay the actual crash/report
  // indefinitely if the write hangs.
  AsyncStorage.setItem(key, JSON.stringify(record))
    .catch(() => {})
    .finally(onDone);
  setTimeout(onDone, 300);
}

export function installGlobalCrashHandler() {
  const g = globalThis as typeof globalThis & { ErrorUtils?: RNErrorUtils };
  if (g.ErrorUtils) {
    const previousHandler = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      let proceeded = false;
      const proceed = () => {
        if (proceeded) return;
        proceeded = true;
        previousHandler(error, isFatal);
      };
      persistRecord(
        KEY,
        { message: error?.message ?? String(error), stack: error?.stack, isFatal: !!isFatal, timestamp: Date.now() },
        proceed
      );
    });
  }

  // Unhandled promise rejections are normally non-fatal in RN release
  // builds (silently logged, app keeps running) — so this alone can't
  // explain a hard crash. But it's cheap to capture too: if a rejection
  // happens moments before an unrelated native-level crash, having it on
  // record (tagged isFatal: false so it's distinguishable from a real
  // fatal error) rules a step in or out without guessing blind again.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rejectionTracking = require("promise/setimmediate/rejection-tracking");
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: Error) => {
        persistRecord(
          REJECTION_KEY,
          { message: error?.message ?? String(error), stack: error?.stack, isFatal: false, timestamp: Date.now() },
          () => {}
        );
      },
      onHandled: () => {},
    });
  } catch {
    // rejection-tracking not available — not fatal to skip it
  }
}
