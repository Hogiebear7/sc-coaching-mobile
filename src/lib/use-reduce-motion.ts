import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Mirrors the OS-level "reduce motion" accessibility setting so animated
// UI (chart draw-ins, fill transitions) can skip straight to their end
// state for members who've asked for that.
export function useReduceMotionPref(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}
