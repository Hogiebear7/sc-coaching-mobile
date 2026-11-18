import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { useLogStyles as useStyles } from "@/components/workout/log-styles";
import { ExerciseDemoMedia } from "@/components/ui/ExerciseDemoMedia";
import type { LegacyPalette } from "@/constants/theme";
import { selectionFeedback } from "@/lib/haptics";
import { pickHeroMedia, pickOwnVideo, pickThumbMedia, useExerciseLibraryDetail } from "@/lib/queries/exercise-library";
import { useLegacyColors } from "@/lib/theme";

// Small pieces of the exercise card (reps in reserve, a note, the demonstration picture and last time's numbers), moved here unchanged from log-workout.tsx so
// the logging screen and the template editor share them.

// Reps in reserve as a row of coloured dots (red = nothing left, blue =
// plenty) instead of a free-text number. Stored exactly as before, as the
// exercise's `rir` string; tapping the selected dot clears it.
const RIR_OPTIONS = ["0", "1", "2", "3", "4", "5", "6"];

export function rirColor(v: string, Color: LegacyPalette): string {
  const n = Number(v);
  if (n <= 1) return Color.danger;
  if (n <= 3) return Color.warning;
  if (n <= 5) return Color.success;
  return Color.accentData;
}

export function RirPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const current = value.trim();
  return (
    <View>
      <View style={styles.rirHead}>
        <Text style={styles.fieldLabel}>Reps in reserve (optional)</Text>
        <Text style={styles.rirHint}>{current ? `${current === "6" ? "6+" : current} left in the tank` : "How many more could you do?"}</Text>
      </View>
      <View style={styles.rirRow} accessibilityRole="radiogroup">
        {RIR_OPTIONS.map((o) => {
          const selected = current === o;
          const c = rirColor(o, Color);
          return (
            <Pressable
              key={o}
              onPress={() => {
                selectionFeedback();
                onChange(selected ? "" : o);
              }}
              style={[styles.rirDot, { borderColor: c }, selected && { backgroundColor: c }]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${o === "6" ? "6 or more" : o} reps in reserve`}
            >
              <Text style={[styles.rirDotText, selected && { color: Color.bg0 }]}>{o === "6" ? "6+" : o}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.rirScale}>
        <Text style={styles.rirScaleText}>Hardest</Text>
        <Text style={styles.rirScaleText}>Easiest</Text>
      </View>
    </View>
  );
}

// "RIR: 3" as a small circle at the bottom of the exercise. Tap it and the choices open; pick one and it closes again.
export function RirControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [open, setOpen] = useState(false);
  const current = value.trim();
  if (open) {
    return (
      <View style={styles.rirOpen}>
        <RirPicker
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </View>
    );
  }
  const c = current ? rirColor(current, Color) : Color.borderDefault;
  return (
    <Pressable
      onPress={() => {
        selectionFeedback();
        setOpen(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={current ? `Reps in reserve ${current === "6" ? "6 or more" : current}. Tap to change.` : "Reps in reserve. Tap to set."}
      style={[styles.rirCircle, { borderColor: c }, current ? { backgroundColor: c } : null]}
    >
      <Text style={[styles.rirCircleText, current ? { color: Color.bg0 } : null]}>{current ? `RIR: ${current === "6" ? "6+" : current}` : "RIR"}</Text>
    </Pressable>
  );
}

// A note on the exercise: a small "Note" button until there is something to say.
export function NoteControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [open, setOpen] = useState(false);
  if (!open && !value.trim()) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Add a note" hitSlop={6} style={styles.noteButton}>
        <Ionicons name="create-outline" size={14} color={Color.textMuted} />
        <Text style={styles.noteButtonText}>Note</Text>
      </Pressable>
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      autoFocus={open && !value.trim()}
      placeholder="e.g. Felt strong, could go heavier"
      placeholderTextColor={Color.textFaint}
      style={styles.smallInput}
    />
  );
}

// Small demo-image thumbnail beside an exercise row, sourced from the same
// exercise library media the "View demonstration" link and library detail
// screen already use — no separate photo system needed. Renders nothing
// while a name has no library match or its media hasn't loaded, so the row
// layout doesn't jump once it resolves.
export function ExerciseThumbnail({ slug, onPress, expanded }: { slug: string | undefined; onPress?: () => void; expanded?: boolean }) {
  const styles = useStyles();
  const { data } = useExerciseLibraryDetail(slug ?? "");
  if (!slug) return null;
  const media = data ? pickThumbMedia(data.media) : null;
  if (!media) return null;
  const image = <Image source={{ uri: media.url }} style={styles.exerciseThumb} resizeMode="cover" />;
  if (!onPress) return image;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ expanded: !!expanded }}
      accessibilityLabel={expanded ? "Hide the animation" : "Show the animation"}
    >
      {image}
    </Pressable>
  );
}

// The picture beside an exercise, the link to the full demonstration page and last time's numbers. Tapping the picture plays the full animation
// inside the card (one at a time would be gentler on the battery, so it closes again on a second tap). The animation is shown at about twice
// its real size at most: the library only holds 180 and 360 pixel renders, and stretching them further makes them blurry.
export function ExerciseDemoRow({
  slug,
  last,
  onOpenDemo,
}: {
  slug: string | null;
  last: { date: string; summary: string } | null | undefined;
  onOpenDemo: (slug: string) => void;
}) {
  const styles = useStyles();
  const Color = useLegacyColors();
  const [expanded, setExpanded] = useState(false);
  const { data } = useExerciseLibraryDetail(slug ?? "");
  const demoMedia = expanded && data && (pickOwnVideo(data.media) || pickHeroMedia(data.media)) ? data.media : null;
  return (
    <View>
      <View style={styles.exerciseInfoRow}>
        {slug ? <ExerciseThumbnail slug={slug} expanded={expanded} onPress={() => setExpanded((v) => !v)} /> : null}
        <View style={styles.exerciseInfoText}>
          {slug ? (
            <Pressable onPress={() => onOpenDemo(slug)} style={styles.demoLink}>
              <Ionicons name="play-circle-outline" size={13} color={Color.gold} />
              <Text style={styles.demoLinkText}>View demonstration</Text>
            </Pressable>
          ) : null}
          {last ? (
            <Text style={styles.lastTimeText}>
              Last time ({last.date}): <Text style={styles.lastTimeValue}>{last.summary}</Text>
            </Text>
          ) : null}
        </View>
      </View>
      {demoMedia ? (
        <Pressable onPress={() => setExpanded(false)} accessibilityRole="button" accessibilityLabel="Hide the animation" style={styles.demoExpanded}>
          <ExerciseDemoMedia media={demoMedia} name="Exercise" size={240} />
        </Pressable>
      ) : null}
    </View>
  );
}
