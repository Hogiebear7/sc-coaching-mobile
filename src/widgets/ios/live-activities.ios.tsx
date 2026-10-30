"use no memo";

// Live Activity layouts run in their own runtime without React; the React Compiler (on for the app) must leave them as plain functions.

import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, progressViewStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

// The iPhone Live Activities (ActivityKit, through expo-widgets), designed to Apple's Live Activity guidelines and matching the in-app
// previews (src/components/widgets/LiveActivityPreviews.tsx):
//   - compact leading/trailing read as one piece of information, snug to the camera; minimal shows live time, not just a logo;
//   - the expanded view enlarges the compact layout; the Lock Screen banner repeats it with the 14pt standard margin;
//   - clocks are SwiftUI timers that count on the device, so the app sends an update only when something changes (a set, a rest, a pause);
//   - the Dynamic Island is always black (Apple's rule); the Lock Screen is navy, or frosted when the member chose the Glass look.
// Layouts run in the widget runtime: no hooks, no imports from the app, everything written out here.

export type WorkoutActivityProps = {
  title: string;
  /** Epoch ms the clock counts up from (start time minus time already counted before pauses). 0 while paused. */
  countFromMs: number;
  /** Seconds counted, shown as a still clock while paused. */
  pausedSecs: number;
  setsDone: number;
  currentExercise: string;
  /** Epoch ms the current rest ends, or 0. */
  restEndsAtMs: number;
  restTotalSecs: number;
  glass: boolean;
};

const WorkoutActivityLayout = (props: WorkoutActivityProps) => {
  "widget";
  const gold = "#e0b866";
  const water = "#5fb4e8";
  const white = "#ffffff";
  const muted = "#ffffffa8";
  const far = new Date(8640000000000000);
  const resting = props.restEndsAtMs > Date.now();
  const clockText = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
  };
  const elapsed = (size: number, color: string) =>
    props.countFromMs > 0 ? (
      <Text timerInterval={{ lower: new Date(props.countFromMs), upper: far }} countsDown={false} modifiers={[font({ size, weight: "bold" }), monospacedDigit(), foregroundStyle(color)]} />
    ) : (
      <Text modifiers={[font({ size, weight: "bold" }), monospacedDigit(), foregroundStyle(color)]}>{clockText(props.pausedSecs)}</Text>
    );
  const rest = (size: number) => (
    <Text
      timerInterval={{ lower: new Date(props.restEndsAtMs - props.restTotalSecs * 1000), upper: new Date(props.restEndsAtMs) }}
      countsDown
      modifiers={[font({ size, weight: "bold" }), monospacedDigit(), foregroundStyle(water)]}
    />
  );
  const detail = `${props.setsDone} sets done${props.currentExercise ? ` · ${props.currentExercise}` : ""}`;
  const lockMuted = props.glass ? "#ffffffe6" : "#ffffffbf";
  const lockAccent = props.glass ? white : gold;
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 }), activityBackgroundTint(props.glass ? "#ffffff30" : "#0a1526")]}>
        <HStack spacing={8}>
          <Text modifiers={[font({ size: 14, weight: "black" }), foregroundStyle(lockAccent)]}>S&amp;C</Text>
          <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          {resting ? rest(30) : elapsed(30, lockAccent)}
        </HStack>
        <Text modifiers={[font({ size: 14, weight: "medium" }), foregroundStyle(lockMuted), lineLimit(1)]}>{resting ? `Resting · ${props.setsDone} sets` : detail}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" color={resting ? water : gold} />,
    compactTrailing: resting ? rest(15) : elapsed(15, gold),
    minimal: resting ? rest(12) : elapsed(12, gold),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6 })]}>
        <Image systemName="dumbbell.fill" color={gold} />
        <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
      </HStack>
    ),
    expandedTrailing: elapsed(28, gold),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 6 })]}>
        {resting ? (
          <HStack spacing={8}>
            <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(water)]}>Rest</Text>
            <ProgressView
              timerInterval={{ lower: new Date(props.restEndsAtMs - props.restTotalSecs * 1000), upper: new Date(props.restEndsAtMs) }}
              countsDown
              modifiers={[progressViewStyle("linear"), tint(water), frame({ maxWidth: 1000 })]}
            />
          </HStack>
        ) : null}
        <Text modifiers={[font({ size: 14, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{detail}</Text>
      </VStack>
    ),
  };
};
export const WorkoutActivity = createLiveActivity("WorkoutActivity", WorkoutActivityLayout);

export type ClassActivityProps = {
  title: string;
  startsAtMs: number;
  /** "Starts at 18:30 · 45 min", formatted by the app. */
  detail: string;
  glass: boolean;
};

const ClassActivityLayout = (props: ClassActivityProps) => {
  "widget";
  const gold = "#e0b866";
  const white = "#ffffff";
  const muted = "#ffffffa8";
  const lockAccent = props.glass ? white : gold;
  const lockMuted = props.glass ? "#ffffffe6" : "#ffffffbf";
  const start = new Date(props.startsAtMs);
  const hourBefore = new Date(props.startsAtMs - 3600000);
  const started = Date.now() >= props.startsAtMs;
  const countdown = (size: number, color: string) =>
    started ? (
      <Text modifiers={[font({ size, weight: "bold" }), foregroundStyle(color)]}>Now</Text>
    ) : (
      <Text timerInterval={{ lower: hourBefore, upper: start }} countsDown modifiers={[font({ size, weight: "bold" }), monospacedDigit(), foregroundStyle(color)]} />
    );
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 }), activityBackgroundTint(props.glass ? "#ffffff30" : "#0a1526")]}>
        <HStack spacing={8}>
          <Text modifiers={[font({ size: 14, weight: "black" }), foregroundStyle(lockAccent)]}>S&amp;C</Text>
          <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          {countdown(30, lockAccent)}
        </HStack>
        <Text modifiers={[font({ size: 14, weight: "medium" }), foregroundStyle(lockMuted)]}>{props.detail}</Text>
        {started ? null : (
          <ProgressView timerInterval={{ lower: hourBefore, upper: start }} countsDown={false} modifiers={[progressViewStyle("linear"), tint(lockAccent)]} />
        )}
      </VStack>
    ),
    compactLeading: <Image systemName="calendar" color={gold} />,
    compactTrailing: countdown(15, gold),
    minimal: countdown(12, gold),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6 })]}>
        <Image systemName="calendar" color={gold} />
        <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(white), lineLimit(1)]}>{props.title}</Text>
      </HStack>
    ),
    expandedTrailing: countdown(28, gold),
    expandedBottom: <Text modifiers={[font({ size: 14, weight: "medium" }), foregroundStyle(muted), padding({ horizontal: 6 })]}>{props.detail}</Text>,
  };
};
export const ClassActivity = createLiveActivity("ClassActivity", ClassActivityLayout);
