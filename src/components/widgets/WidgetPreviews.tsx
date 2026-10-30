import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { describeClassTime, litres, progress, type ClassWidgetData, type NutritionWidgetData, type WaterWidgetData } from "@/lib/widgets/snapshot";
import type { WidgetStyle } from "@/lib/widgets/widget-style";

// In-app pictures of the three home-screen widgets, drawn from the same snapshot the real widgets read (src/lib/widgets/snapshot.ts), so the
// Widgets screen shows the member exactly what they'll get. Two looks (lib/widgets/widget-style.ts): "navy", the brand's navy and gold in both
// light and dark mode like the app icon, and "glass", a see-through frosted panel over the wallpaper. Neither follows the app theme.

const NAVY = "#0a1526";
const NAVY_HI = "#16243a";
const GOLD = "#c6a15b";
const WATER = "#5fb4e8";
const TEXT = "#fcfeff";
const MUTED = "rgba(255,255,255,0.62)";
const SMALL = 158;

// The widget's background: solid navy, or frosted glass (a light see-through fill, a bright edge and a soft sheen; blurred behind on web).
function Frame({ look, style, label, children }: { look: WidgetStyle; style: StyleProp<ViewStyle>; label: string; children: ReactNode }) {
  if (look === "navy") {
    return (
      <View style={[styles.widget, style]} accessible accessibilityLabel={label}>
        {children}
      </View>
    );
  }
  const blur = Platform.OS === "web" ? ({ backdropFilter: "blur(22px) saturate(170%)" } as unknown as ViewStyle) : null;
  return (
    <View style={[styles.widget, styles.glass, style, blur]} accessible accessibilityLabel={label}>
      <LinearGradient
        colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.16)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function Ring({ value, color, size = 74, stroke = 8, track = "rgba(255,255,255,0.12)" }: { value: number; color: string; size?: number; stroke?: number; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" />
    </Svg>
  );
}

export function WaterWidgetPreview({ data, onAdd, look = "navy" }: { data: WaterWidgetData; onAdd?: () => void; look?: WidgetStyle }) {
  const p = progress(data.loggedMl, data.targetMl);
  const g = look === "glass";
  return (
    <Frame look={look} style={styles.small} label={`Water widget: ${litres(data.loggedMl)}${data.targetMl ? ` of ${litres(data.targetMl)}` : ""}`}>
      <View style={styles.head}>
        <Ionicons name="water" size={14} color={WATER} />
        <Text style={[styles.label, g && styles.glassSub]}>Water</Text>
      </View>
      <View style={styles.ringRow}>
        <View>
          <Ring value={p} color={WATER} size={64} stroke={7} track={g ? "rgba(255,255,255,0.28)" : undefined} />
          <Text style={styles.ringCenter}>{data.targetMl ? `${Math.round(p * 100)}%` : ""}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{litres(data.loggedMl)}</Text>
          <Text style={[styles.sub, g && styles.glassSub]}>{data.targetMl ? `of ${litres(data.targetMl)}` : "today"}</Text>
        </View>
      </View>
      <Pressable onPress={onAdd} style={styles.addButton} accessibilityRole="button" accessibilityLabel={`Add ${data.amountMl} ml`}>
        <Text style={styles.addText}>+{data.amountMl} ml</Text>
      </Pressable>
    </Frame>
  );
}

export function NutritionWidgetPreview({ data, look = "navy" }: { data: NutritionWidgetData; look?: WidgetStyle }) {
  const p = progress(data.calories, data.targetCalories);
  const left = data.targetCalories !== null ? data.targetCalories - data.calories : null;
  const g = look === "glass";
  return (
    <Frame look={look} style={styles.small} label={`Nutrition widget: ${data.calories} calories${data.targetCalories ? ` of ${data.targetCalories}` : ""}`}>
      <View style={styles.head}>
        <Ionicons name="restaurant" size={13} color={g ? TEXT : GOLD} />
        <Text style={[styles.label, g && styles.glassSub]}>Nutrition</Text>
      </View>
      <Text style={styles.big}>
        {data.calories.toLocaleString("en-IE")}
        <Text style={[styles.unit, g && styles.glassSub]}> kcal</Text>
      </Text>
      <Text style={[styles.sub, g && styles.glassSub]}>
        {left === null ? "eaten today" : left >= 0 ? `${left.toLocaleString("en-IE")} left of ${data.targetCalories!.toLocaleString("en-IE")}` : `${(-left).toLocaleString("en-IE")} over`}
      </Text>
      {data.targetCalories !== null ? (
        <View style={[styles.bar, g && styles.glassTrack]}>
          <View style={[styles.barFill, { width: `${p * 100}%` }]} />
        </View>
      ) : null}
      <Text style={[styles.sub, g && styles.glassSub]}>
        Protein {data.proteinG} g{data.targetProteinG ? ` / ${data.targetProteinG} g` : ""}
      </Text>
      <View style={styles.logRow}>
        <Ionicons name="add-circle" size={16} color={g ? TEXT : GOLD} />
        <Text style={[styles.logText, g && styles.glassAccent]}>Log food</Text>
      </View>
    </Frame>
  );
}

export function ClassWidgetPreview({ data, now = new Date(), look = "navy" }: { data: ClassWidgetData; now?: Date; look?: WidgetStyle }) {
  const g = look === "glass";
  return (
    <Frame look={look} style={styles.medium} label={data.next ? `Next class: ${data.next.title}, ${describeClassTime(data.next.date, data.next.startTime, now)}` : "No class booked"}>
      <View style={styles.head}>
        <Ionicons name="calendar" size={13} color={g ? TEXT : GOLD} />
        <Text style={[styles.label, g && styles.glassSub]}>Next class</Text>
      </View>
      <View style={styles.mediumBody}>
        <View style={{ flex: 1 }}>
          {data.next ? (
            <>
              <Text style={styles.classTitle} numberOfLines={1}>
                {data.next.title}
              </Text>
              <Text style={[styles.classTime, g && styles.glassAccent]}>{describeClassTime(data.next.date, data.next.startTime, now)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.classTitle}>{data.canBook ? "Nothing booked" : "No membership yet"}</Text>
              <Text style={[styles.sub, g && styles.glassSub]}>{data.canBook ? "Tap to book a class" : "Tap to see classes"}</Text>
            </>
          )}
        </View>
        {data.classesLeft !== null ? (
          <View style={[styles.leftBox, g && styles.glassBox]}>
            <Text style={styles.leftNumber}>{data.classesLeft}</Text>
            <Text style={[styles.leftLabel, g && styles.glassSub]}>{data.classesLeft === 1 ? "class left" : "classes left"}</Text>
          </View>
        ) : null}
      </View>
      {data.next && data.canBook ? <Text style={[styles.footer, g && styles.glassAccent]}>Book another</Text> : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  widget: { backgroundColor: NAVY, borderRadius: 22, padding: 14, gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  glass: { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.38)", overflow: "hidden" },
  small: { width: SMALL, height: SMALL },
  medium: { width: SMALL * 2 + 16, height: SMALL },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: MUTED, fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, textAlign: "center", textAlignVertical: "center", lineHeight: 64, color: TEXT, fontSize: 13, fontWeight: "700" },
  big: { color: TEXT, fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  unit: { color: MUTED, fontSize: 13, fontWeight: "600" },
  sub: { color: MUTED, fontSize: 12, fontVariant: ["tabular-nums"] },
  glassSub: { color: "rgba(255,255,255,0.88)", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 4 },
  // Gold loses its contrast over a bright or warm wallpaper, so on glass the accents are white with a soft shadow.
  glassAccent: { color: TEXT, textShadowColor: "rgba(0,0,0,0.3)", textShadowRadius: 4 },
  addButton: { backgroundColor: WATER, borderRadius: 12, paddingVertical: 7, alignItems: "center" },
  addText: { color: NAVY, fontSize: 14, fontWeight: "700" },
  bar: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  glassTrack: { backgroundColor: "rgba(255,255,255,0.28)" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  logRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: "auto" },
  logText: { color: GOLD, fontSize: 13, fontWeight: "700" },
  mediumBody: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  classTitle: { color: TEXT, fontSize: 19, fontWeight: "700" },
  classTime: { color: GOLD, fontSize: 15, fontWeight: "600", marginTop: 2 },
  leftBox: { backgroundColor: NAVY_HI, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", minWidth: 84 },
  glassBox: { backgroundColor: "rgba(255,255,255,0.18)" },
  leftNumber: { color: TEXT, fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  leftLabel: { color: MUTED, fontSize: 11, fontWeight: "600" },
  footer: { color: GOLD, fontSize: 12, fontWeight: "700" },
});
