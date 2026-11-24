import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth-context";

import { parseBenchmarks, type BenchmarkValues } from "./index";

// Benchmarks live on the phone, one set per signed-in account (same approach as goals and rehab). Nothing is sent to the server.
const KEY_PREFIX = "sc.benchmarks.v1.";

export async function loadBenchmarks(userId: string): Promise<BenchmarkValues> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    return raw ? parseBenchmarks(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function saveBenchmarks(userId: string, values: BenchmarkValues): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(values));
  } catch {
    // Best-effort.
  }
}

/** The signed-in member's benchmarks, reloaded whenever the screen comes into focus. */
export function useBenchmarks(): { loading: boolean; values: BenchmarkValues; save: (v: BenchmarkValues) => Promise<void> } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [values, setValues] = useState<BenchmarkValues>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!userId) {
        setLoading(false);
        return;
      }
      void loadBenchmarks(userId).then((v) => {
        if (cancelled) return;
        setValues(v);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  return {
    loading,
    values,
    save: async (v) => {
      setValues(v);
      if (userId) await saveBenchmarks(userId, v);
    },
  };
}
