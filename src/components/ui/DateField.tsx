import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { Color, Radius, Spacing } from "@/constants/theme";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToParts(iso: string | undefined): { y: number; m: number; d: number } | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Display format is DD-MM-YYYY regardless of device locale — the ISO wire
// format (YYYY-MM-DD) is what the backend stores and validates against
// (see profile-schema.ts / the signup routes in the main repo), so this
// component only ever converts at the edges.
export function formatDateDisplay(iso: string): string {
  const parts = isoToParts(iso);
  if (!parts) return "";
  return `${pad(parts.d)}-${pad(parts.m)}-${parts.y}`;
}

function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = "DD-MM-YYYY",
  error,
  maxDate,
  minDate,
  style,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string | null;
  /** Inclusive ISO (YYYY-MM-DD) bound. */
  maxDate?: string;
  /** Inclusive ISO (YYYY-MM-DD) bound. */
  minDate?: string;
  style?: ViewStyle;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "years">("days");
  const now = new Date();
  const todayParts = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const [viewY, setViewY] = useState(() => isoToParts(value)?.y ?? isoToParts(maxDate)?.y ?? todayParts.y);
  const [viewM, setViewM] = useState(() => isoToParts(value)?.m ?? isoToParts(maxDate)?.m ?? todayParts.m);

  // Generous fallback bounds so a birth date decades back (or a member
  // tracking cycles years back) is a scroll away, not hundreds of taps —
  // narrowed to whatever min/maxDate the caller actually passed.
  const topYear = isoToParts(maxDate)?.y ?? todayParts.y;
  const bottomYear = isoToParts(minDate)?.y ?? todayParts.y - 120;
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = topYear; y >= bottomYear; y--) years.push(y);
    return years;
  }, [topYear, bottomYear]);

  function openPicker() {
    const parts = isoToParts(value) ?? isoToParts(maxDate) ?? todayParts;
    setViewY(parts.y);
    setViewM(parts.m);
    setMode("days");
    setOpen(true);
  }

  function selectYear(y: number) {
    setViewY(y);
    setMode("days");
  }

  function changeMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewY(y);
    setViewM(m);
  }

  function isDisabled(d: number): boolean {
    const iso = toISO(viewY, viewM, d);
    if (maxDate && iso > maxDate) return true;
    if (minDate && iso < minDate) return true;
    return false;
  }

  function handleSelect(d: number) {
    if (isDisabled(d)) return;
    onChange(toISO(viewY, viewM, d));
    setOpen(false);
  }

  const selected = isoToParts(value);
  const totalDays = daysInMonth(viewY, viewM);
  const firstWeekday = mondayIndex(new Date(viewY, viewM - 1, 1).getDay());
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={[styles.input, error ? styles.inputError : null]}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDateDisplay(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={Color.textFaint} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calHeader}>
              <Pressable
                onPress={() => changeMonth(-1)}
                hitSlop={12}
                style={styles.calNavButton}
                disabled={mode === "years"}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={mode === "years" ? Color.textFaint : Color.textPrimary}
                />
              </Pressable>
              <Pressable
                onPress={() => setMode(mode === "years" ? "days" : "years")}
                style={styles.calTitleButton}
                hitSlop={8}
              >
                <Text style={styles.calTitle}>
                  {mode === "years" ? "Select year" : `${MONTH_LABELS[viewM - 1]} ${viewY}`}
                </Text>
                <Ionicons
                  name={mode === "years" ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={Color.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={() => changeMonth(1)}
                hitSlop={12}
                style={styles.calNavButton}
                disabled={mode === "years"}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={mode === "years" ? Color.textFaint : Color.textPrimary}
                />
              </Pressable>
            </View>

            {mode === "years" ? (
              <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
                {yearOptions.map((y) => {
                  const isSelected = y === viewY;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => selectYear(y)}
                      style={[styles.yearCell, isSelected && styles.cellSelected]}
                    >
                      <Text style={[styles.yearCellText, isSelected && styles.cellTextSelected]}>{y}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.weekRow}>
                  {WEEKDAY_LABELS.map((w) => (
                    <Text key={w} style={styles.weekLabel}>
                      {w}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {cells.map((d, i) => {
                    if (d === null) return <View key={i} style={styles.cell} />;
                    const disabled = isDisabled(d);
                    const isSelected = !!selected && selected.y === viewY && selected.m === viewM && selected.d === d;
                    const isToday = todayParts.y === viewY && todayParts.m === viewM && todayParts.d === d;
                    return (
                      <Pressable
                        key={i}
                        disabled={disabled}
                        onPress={() => handleSelect(d)}
                        style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            disabled && styles.cellTextDisabled,
                            isSelected && styles.cellTextSelected,
                          ]}
                        >
                          {d}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: "500", color: Color.textSecondary, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputError: { borderColor: Color.danger },
  valueText: { fontSize: 15, color: Color.textPrimary },
  placeholderText: { fontSize: 15, color: Color.textFaint },
  error: { fontSize: 12, color: Color.danger, marginTop: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    padding: Spacing.lg,
  },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  calNavButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface2,
  },
  calTitleButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  calTitle: { fontSize: 15, fontWeight: "700", color: Color.textPrimary },
  yearScroll: { maxHeight: 260 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: Spacing.xs },
  yearCell: {
    width: "33.33%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
  },
  yearCellText: { fontSize: 14, color: Color.textSecondary },
  weekRow: { flexDirection: "row", marginBottom: Spacing.xs },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: Color.textFaint },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
  },
  cellSelected: { backgroundColor: Color.gold },
  cellToday: { borderWidth: 1, borderColor: Color.goldBorder },
  cellText: { fontSize: 13, color: Color.textSecondary },
  cellTextDisabled: { color: Color.textFaint },
  cellTextSelected: { color: Color.goldForeground, fontWeight: "700" },
  closeButton: { marginTop: Spacing.md, alignItems: "center", paddingVertical: Spacing.sm },
  closeButtonText: { fontSize: 13, fontWeight: "600", color: Color.textMuted },
});
