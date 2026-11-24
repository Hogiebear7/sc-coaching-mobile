import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { activeSoreAreas, type SoreNote } from "@/lib/injury-intake";
import type { InjuryArea } from "@/lib/session-engine/types";

// "Go easy on this area" notes from the injury entry in the coach chat. On the phone only, per account, and they lapse on their own (SORE_TTL_DAYS).
const KEY_PREFIX = "sc.soreAreas.v1.";

export async function saveSoreAreas(userId: string, areas: InjuryArea[]): Promise<void> {
  try {
    const note: SoreNote = { areas, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(note));
  } catch {
    // Best-effort.
  }
}

export async function clearSoreAreas(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    // Best-effort.
  }
}

export async function loadSoreAreas(userId: string): Promise<InjuryArea[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    return activeSoreAreas(raw ? (JSON.parse(raw) as SoreNote) : null, new Date());
  } catch {
    return [];
  }
}

/** The signed-in member's current sore-area note, reloaded whenever the screen comes into focus. */
export function useSoreAreas(): { areas: InjuryArea[]; save: (areas: InjuryArea[]) => Promise<void>; clear: () => Promise<void> } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [areas, setAreas] = useState<InjuryArea[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!userId) return;
      void loadSoreAreas(userId).then((a) => {
        if (!cancelled) setAreas(a);
      });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  return {
    areas,
    save: async (a) => {
      setAreas(a);
      if (userId) await saveSoreAreas(userId, a);
    },
    clear: async () => {
      setAreas([]);
      if (userId) await clearSoreAreas(userId);
    },
  };
}
