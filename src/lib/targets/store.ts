import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";

import { EMPTY_STATE, addEntry, parseState, removeTarget, undoLastEntry, upsertTarget, type TargetsState } from "./data";
import type { Target } from "./index";
import { syncTargetReminders } from "./reminders";

// Goals and rehab live on the phone (AsyncStorage), one list per signed-in account, so a second person on the same phone never sees them.
// Nothing is sent to the server. That keeps this feature fully separate from the live system, at the cost that the list does not follow a member
// to a new phone and the coach cannot see it yet.

const KEY_PREFIX = "sc.targets.v1.";

export async function loadTargetsState(userId: string): Promise<TargetsState> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    return raw ? parseState(JSON.parse(raw)) : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveTargetsState(userId: string, state: TargetsState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(state));
  } catch {
    // Best-effort: the screen already shows the new state for this session.
  }
}

export interface UseTargets {
  loading: boolean;
  targets: Target[];
  entries: TargetsState["entries"];
  state: TargetsState;
  save: (target: Target) => Promise<void>;
  remove: (id: string) => Promise<void>;
  log: (id: string, amount: number) => Promise<void>;
  undo: (id: string) => Promise<void>;
}

/** The signed-in member's goals and rehab, reloaded every time the screen comes into focus (so Home and the goals screen never disagree). */
export function useTargets(): UseTargets {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<TargetsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const latest = useRef<TargetsState>(EMPTY_STATE);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!userId) {
        setLoading(false);
        return;
      }
      void loadTargetsState(userId).then((s) => {
        if (cancelled) return;
        latest.current = s;
        setState(s);
        setLoading(false);
        void syncTargetReminders(s);
      });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const commit = useCallback(
    async (next: TargetsState) => {
      latest.current = next;
      setState(next);
      if (userId) await saveTargetsState(userId, next);
      await syncTargetReminders(next);
    },
    [userId],
  );

  return {
    loading,
    targets: state.targets,
    entries: state.entries,
    state,
    save: (target) => commit(upsertTarget(latest.current, target)),
    remove: (id) => commit(removeTarget(latest.current, id)),
    log: (id, amount) => commit(addEntry(latest.current, id, amount, new Date())),
    undo: (id) => commit(undoLastEntry(latest.current, id)),
  };
}
