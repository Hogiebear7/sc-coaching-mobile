import AsyncStorage from "@react-native-async-storage/async-storage";

// Diagnostic-only crash capture — there's no Sentry/Crashlytics wired into
// this app, so a fatal JS error in a release build otherwise leaves no
// trace at all (no red-box, no log anyone can retrieve). This persists the
// error to disk from RN's global error handler so it can be shown back to
// the member on next launch, screenshotted, and sent to the dev — the only
// way to get a real stack trace out of a production crash right now.
const KEY = "last-crash-v1";

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

interface RNErrorUtils {
  setGlobalHandler: (fn: (error: Error, isFatal?: boolean) => void) => void;
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
}

export function installGlobalCrashHandler() {
  const g = globalThis as typeof globalThis & { ErrorUtils?: RNErrorUtils };
  if (!g.ErrorUtils) return;

  const previousHandler = g.ErrorUtils.getGlobalHandler();

  g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    let proceeded = false;
    const proceed = () => {
      if (proceeded) return;
      proceeded = true;
      previousHandler(error, isFatal);
    };

    const record: CrashRecord = {
      message: error?.message ?? String(error),
      stack: error?.stack,
      isFatal: !!isFatal,
      timestamp: Date.now(),
    };

    // AsyncStorage writes are async over the bridge — the app may
    // terminate before the promise resolves, so this is best-effort, not
    // guaranteed. The 300ms fallback ensures we never delay the actual
    // crash/report indefinitely if the write hangs.
    AsyncStorage.setItem(KEY, JSON.stringify(record))
      .catch(() => {})
      .finally(proceed);
    setTimeout(proceed, 300);
  });
}
