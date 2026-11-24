import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { selectionFeedback, tapFeedback } from "@/lib/haptics";
import { makeLegacyStyles } from "@/lib/theme";

// The small "BW" button on a weight box. Turning bodyweight ON takes two taps (the first one only arms it and says "again"), so a stray tap cannot replace the
// weights the member has typed; turning it OFF takes one. What was typed is kept and comes back (see bodyweightFrom).
export function BodyweightButton({ active, label, onConfirm }: { active: boolean; label: string; onConfirm: () => void }) {
  const styles = useStyles();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function press() {
    if (active) {
      selectionFeedback();
      onConfirm();
      return;
    }
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      selectionFeedback();
      onConfirm();
      return;
    }
    tapFeedback();
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 1500);
  }

  return (
    <Pressable
      onPress={press}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      accessibilityHint={active ? "Tap to clear bodyweight and bring back your numbers" : "Tap twice to use bodyweight"}
      style={[styles.pill, active && styles.pillOn, armed && styles.pillArmed]}
    >
      <Text style={[styles.text, active && styles.textOn, armed && styles.textArmed]}>{armed ? "again" : "BW"}</Text>
    </Pressable>
  );
}

const useStyles = makeLegacyStyles((Color) =>
  StyleSheet.create({
    pill: { minWidth: 28, height: 26, borderRadius: 13, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: Color.surface1, borderWidth: 1, borderColor: "transparent" },
    pillOn: { backgroundColor: Color.gold },
    pillArmed: { borderColor: Color.gold },
    text: { fontSize: 11, fontWeight: "800", color: Color.textMuted },
    textOn: { color: Color.goldForeground },
    textArmed: { color: Color.gold },
  })
);
