import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconSelect } from "@/components/ui/IconSelect";
import { Segmented } from "@/components/ui/Segmented";
import { Color, Radius, Spacing } from "@/constants/theme";
import type { DrinkSettings } from "@/lib/drink-settings";
import { useNutrition, useSaveDrinkSettings } from "@/lib/queries/nutrition";
import {
  buildDrinkMix,
  buildDrinkPlan,
  drinkDurationInfo,
  drinkWorkload,
  ROLE_ARCHETYPE_ICON,
  RUN_EFFORTS,
  sodiumTargetPerLitre,
  SPORT_DATA,
  type RunEffort,
  type SportId,
  type SweatProfile,
  type TempProfile,
} from "@/lib/nutrition-calc";

const BOTTLE_OPTIONS = [500, 750, 1000] as const;
const RUN_PRESETS = [
  { label: "3k", km: 3 },
  { label: "5k", km: 5 },
  { label: "10k", km: 10 },
  { label: "15k", km: 15 },
  { label: "Half", km: 21.1 },
  { label: "Marathon", km: 42.2 },
] as const;
const SPORT_OPTIONS = Object.keys(SPORT_DATA) as SportId[];
const RUN_EFFORT_OPTIONS = Object.keys(RUN_EFFORTS) as RunEffort[];
const SWEAT_OPTIONS: SweatProfile[] = ["low", "medium", "high"];
const TEMP_OPTIONS: TempProfile[] = ["cool", "warm", "hot"];
const SWEAT_LABEL: Record<SweatProfile, string> = { low: "Low", medium: "Medium", high: "High" };
const TEMP_LABEL: Record<TempProfile, string> = { cool: "Cool", warm: "Warm", hot: "Hot" };
const SWEAT_HINT: Record<SweatProfile, string> = {
  low: "Little residue on kit, rarely cramps.",
  medium: "Some white marks on kit after hard sessions.",
  high: "White crust on kit, sweat stings eyes, cramp-prone late on.",
};
const TEMP_HINT: Record<TempProfile, string> = {
  cool: "Under 18°C — little extra fluid loss.",
  warm: "18–25°C — noticeably higher sweat rate.",
  hot: "Over 25°C — fluid and sodium losses climb sharply.",
};

function sodiumBadgeStyle(badge: "below" | "optimal" | "high") {
  if (badge === "optimal") return { border: Color.success, bg: Color.successWeak, text: Color.success, dot: Color.success };
  if (badge === "high") return { border: Color.warning, bg: Color.warningWeak, text: Color.warning, dot: Color.warning };
  return { border: Color.borderSubtle, bg: Color.surface2, text: Color.textMuted, dot: Color.textFaint };
}

// Mirrors INGREDIENT_BENEFITS in the main repo's NutritionView.tsx — same
// copy, ported verbatim rather than paraphrased.
const INGREDIENT_BENEFITS: {
  name: string;
  tag: string;
  summary: string;
  whatItIs: string;
  whyItHelps: string;
  detail: string;
}[] = [
  {
    name: "Maltodextrin",
    tag: "Energy",
    summary: "Fast carbohydrate to fuel long, intense sessions.",
    whatItIs:
      "A carbohydrate made by partially breaking down starch — usually corn, though sometimes rice or potato — into shorter chains of glucose. It isn't a sugar itself, but the body digests it almost as fast as one.",
    whyItHelps:
      "Because it breaks down to glucose so quickly, it tops up blood sugar during exercise, which spares the glycogen stored in your muscles. That stored glycogen is limited — once it runs low, output drops — so feeding the body sugar from the drink instead delays that fade.",
    detail:
      "Sports drinks are commonly built around 4–8 g of carbohydrate per 100 ml — roughly 60 g per litre for isotonic use — because concentration matters for both fuel delivery and fluid absorption. Maltodextrin digests quickly with a mild taste, which is why it's the base carbohydrate here.",
  },
  {
    name: "Beta-alanine",
    tag: "Buffering",
    summary: "Supports repeated hard efforts by helping buffer acidity.",
    whatItIs:
      "A naturally occurring amino acid, made in the liver and also found in meat and fish. The body combines it with another amino acid, histidine, to build carnosine, which is stored in muscle tissue.",
    whyItHelps:
      "Hard efforts produce acid in working muscle, and that build-up is a big part of why a set or sprint starts to burn and fade. Carnosine acts as a buffer — it soaks up some of that acid — so more beta-alanine in the diet means more carnosine in the muscle, and a bit more tolerance for repeated hard efforts before the burn sets in.",
    detail:
      "Included as part of the recipe ratio, though the biggest benefit comes from regular daily use over weeks rather than only on game day. A mild skin tingle at higher doses is normal and harmless.",
  },
  {
    name: "Chia seeds",
    tag: "Texture",
    summary: "Adds a slow-gel texture and a little fibre and fat.",
    whatItIs:
      "Small edible seeds from the Salvia hispanica plant, native to Central America. They're mostly soluble fibre, which is what makes them swell and form a gel when soaked in liquid.",
    whyItHelps:
      "The fibre gel slightly slows how fast the drink empties from the stomach, which can smooth out carbohydrate delivery over a long session instead of it arriving all at once. It's a texture and pacing addition, not a major energy source on its own.",
    detail:
      "Soaked chia adds body without much flavour. The amount stays modest so the drink is easy to tolerate and quick to get down during short breaks.",
  },
  {
    name: "Beetroot powder",
    tag: "Nitrate",
    summary: "Dietary nitrate may support exercise efficiency.",
    whatItIs:
      "Whole beetroot that's been juiced or pureed, then dried and ground into a fine powder — concentrated specifically for its naturally high dietary nitrate content.",
    whyItHelps:
      "Nitrate is a naturally occurring compound (found in beetroot and leafy greens) that the body converts, via bacteria in the mouth and then the gut, into nitric oxide. Nitric oxide relaxes and widens blood vessels, improving blood flow to working muscle and reducing the amount of oxygen the body needs to produce the same effort — meaning the same pace or output feels a little easier to sustain.",
    detail:
      "Dietary nitrate can modestly reduce the oxygen cost of exercise. The dose is adjusted to your role or run distance first, then scaled with bottle size so concentration stays stable.",
  },
  {
    name: "Orange concentrate",
    tag: "Flavour",
    summary: "Makes the drink more palatable, plus a little fructose.",
    whatItIs:
      "Orange juice with most of its water removed, leaving a concentrated syrup of natural sugars, citrus flavour, and a small amount of vitamin C.",
    whyItHelps:
      "A drink that tastes good gets finished — and under-drinking because a drink is bland or too sweet is one of the most common reasons athletes end a session dehydrated. Flavour also drives thirst, and its natural fructose adds to the carbohydrate mix alongside maltodextrin, which the body can absorb faster than either sugar alone.",
    detail:
      "Better-tasting drinks get finished, and sodium works with flavour to stimulate thirst. The small fructose contribution also pairs with maltodextrin for carbohydrate uptake.",
  },
  {
    name: "Salt",
    tag: "Electrolyte",
    summary: "Replaces sweat sodium, drives thirst, and helps retain fluid.",
    whatItIs: "Sodium chloride — the same table salt used in cooking. It's included here purely for its sodium content, not for flavour.",
    whyItHelps:
      "Sodium is the main electrolyte lost in sweat, and it's what keeps fluid inside your bloodstream rather than being lost as excess urine. Replacing it helps maintain blood volume during long or hot sessions, and it's also what triggers the feeling of thirst in the first place — without enough sodium, the drive to keep drinking drops off even while you're still losing fluid.",
    detail:
      "A practical in-drink sodium target is 400–1100 mg per litre depending on sweat loss and conditions — higher for salty sweaters and hot sessions. Your dose comes from the sweat and conditions settings above.",
  },
];

export default function DrinkCalculatorScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useNutrition();
  const saveSettings = useSaveDrinkSettings();

  const [sport, setSport] = useState<SportId>("soccer");
  const [role, setRole] = useState(SPORT_DATA.soccer.defaultRole);
  const [durationIdx, setDurationIdx] = useState(SPORT_DATA.soccer.defaultDurationIdx);
  const [runKm, setRunKm] = useState(10);
  const [runKmText, setRunKmText] = useState("10");
  const [runEffort, setRunEffort] = useState<RunEffort>("steady");
  const [bottleMl, setBottleMl] = useState<(typeof BOTTLE_OPTIONS)[number]>(1000);
  const [sweat, setSweat] = useState<SweatProfile>("medium");
  const [temp, setTemp] = useState<TempProfile>("cool");
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [openBenefit, setOpenBenefit] = useState<string | null>(null);

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !data) return;
    hydrated.current = true;
    const saved = data.drinkSettings;
    if (!saved) return;
    setSport(saved.sport);
    setRole(saved.role);
    setDurationIdx(saved.durationIdx);
    setRunKm(saved.runKm);
    setRunKmText(String(saved.runKm));
    setRunEffort(saved.runEffort);
    if (saved.bottleMl === 500 || saved.bottleMl === 750 || saved.bottleMl === 1000) setBottleMl(saved.bottleMl);
    setSweat(saved.sweat);
    setTemp(saved.temp);
  }, [data]);

  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const settings: DrinkSettings = { sport, role, durationIdx, runKm, runEffort, bottleMl, sweat, temp };
    const timer = setTimeout(() => saveSettings.mutate(settings), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, role, durationIdx, runKm, runEffort, bottleMl, sweat, temp]);

  function handleSportChange(next: SportId) {
    setSport(next);
    setRole(SPORT_DATA[next].defaultRole);
    setDurationIdx(SPORT_DATA[next].defaultDurationIdx);
  }

  function applyRunPreset(km: number) {
    setRunKm(km);
    setRunKmText(String(km));
  }

  function handleRunKmBlur() {
    const parsed = parseFloat(runKmText);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 50) {
      const rounded = Math.round(parsed * 10) / 10;
      setRunKm(rounded);
      setRunKmText(String(rounded));
    } else {
      setRunKmText(String(runKm));
    }
  }

  const weight = data?.bodyWeightKg ?? 75;
  const sportCfg = SPORT_DATA[sport];

  const drinkInput = useMemo(
    () => ({ bodyWeightKg: weight, bottleMl, sweat, temp, sport, role, durationIdx, runKm, runEffort }),
    [weight, bottleMl, sweat, temp, sport, role, durationIdx, runKm, runEffort]
  );
  const drink = useMemo(() => buildDrinkMix(drinkInput), [drinkInput]);
  const plan = useMemo(() => buildDrinkPlan(drinkInput), [drinkInput]);
  const workload = drinkWorkload(drinkInput);
  const durationInfo = drinkDurationInfo(drinkInput);
  const badge = sodiumBadgeStyle(drink.sodiumBadge);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Color.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Sports Drink</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Color.gold} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>Couldn&apos;t load the calculator.</Text>
          <Button title="Retry" onPress={() => refetch()} variant="secondary" style={{ marginTop: Spacing.md }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Sport</Text>
          <IconSelect
            value={sport}
            onChange={handleSportChange}
            options={SPORT_OPTIONS.map((key) => ({ value: key, label: SPORT_DATA[key].label, icon: SPORT_DATA[key].icon }))}
          />

          {sportCfg.runMode ? (
            <>
              <View style={styles.gridRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Distance (km)</Text>
                  <TextInput
                    value={runKmText}
                    onChangeText={setRunKmText}
                    onBlur={handleRunKmBlur}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 7.5"
                    placeholderTextColor={Color.textFaint}
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Effort</Text>
                  <Segmented options={RUN_EFFORT_OPTIONS} value={runEffort} onChange={setRunEffort} format={(v) => RUN_EFFORTS[v].label} />
                </View>
              </View>
              <View style={styles.presetRow}>
                {RUN_PRESETS.map((preset) => (
                  <Pressable key={preset.label} onPress={() => applyRunPreset(preset.km)} style={[styles.presetChip, runKm === preset.km && styles.presetChipActive]}>
                    <Text style={[styles.presetChipText, runKm === preset.km && styles.presetChipTextActive]}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View>
              <Text style={styles.fieldLabel}>{sportCfg.roleLabel}</Text>
              <IconSelect
                value={role}
                onChange={setRole}
                options={Object.entries(sportCfg.roles).map(([key, r]) => ({
                  value: key,
                  label: r.label,
                  icon: ROLE_ARCHETYPE_ICON[r.archetype],
                  sublabel: r.dist,
                }))}
              />
            </View>
          )}
          <Text style={styles.hintText}>{workload.desc}</Text>

          <View style={styles.gridRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Bottle</Text>
              <Segmented options={BOTTLE_OPTIONS} value={bottleMl} onChange={setBottleMl} format={(v) => `${v} ml`} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{sportCfg.runMode ? "Run duration" : "Session length"}</Text>
              {sportCfg.runMode ? (
                <View style={styles.durationBox}>
                  <Text style={styles.durationValue}>≈ {durationInfo.mins} min</Text>
                  <Text style={styles.durationSub}>from distance & effort</Text>
                </View>
              ) : (
                <Segmented
                  options={sportCfg.durations.map((_, i) => i)}
                  value={durationIdx}
                  onChange={setDurationIdx}
                  format={(i) => sportCfg.durations[i].short}
                />
              )}
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Sweat rate</Text>
              <Segmented options={SWEAT_OPTIONS} value={sweat} onChange={setSweat} format={(v) => SWEAT_LABEL[v]} />
              <Text style={styles.hintTextSmall}>{SWEAT_HINT[sweat]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Conditions</Text>
              <Segmented options={TEMP_OPTIONS} value={temp} onChange={setTemp} format={(v) => TEMP_LABEL[v]} />
              <Text style={styles.hintTextSmall}>{TEMP_HINT[temp]}</Text>
            </View>
          </View>

          <Card style={styles.infoCard}>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: "700", color: Color.textPrimary }}>Why these settings matter: </Text>
              saltier sweat means more sodium lost per litre — light sweaters do well near 300–500 mg/L, salty
              sweaters near 600–900 mg/L. Heat and longer sessions raise both fluid and sodium loss, so the same
              athlete needs a stronger mix on a hot day. These settings move the{" "}
              <Text style={{ fontWeight: "600", color: Color.textPrimary }}>salt</Text> line only; carbs are set by
              your body weight.
            </Text>
            <Text style={styles.infoTextGold}>
              Current target: ~{sodiumTargetPerLitre(sweat, temp)} mg sodium per litre
              {temp === "hot"
                ? " — in the heat, add extra plain water alongside this bottle rather than making the mix stronger."
                : "."}
            </Text>
          </Card>

          <Text style={styles.mixedForText}>
            Mixed for {weight} kg{data.bodyWeightKg === null ? " (default)" : ""} · {bottleMl} ml bottle
          </Text>

          <Card style={styles.ingredientsCard}>
            {[
              { name: "Maltodextrin", amount: `${drink.maltodextrinG} g` },
              { name: "Beta-alanine", amount: `${drink.betaAlanineG} g` },
              { name: "Chia seeds", amount: `${drink.chiaG} g` },
              { name: "Beetroot powder", amount: `${drink.beetrootG} g` },
              { name: "Orange concentrate", amount: `${drink.orangeMl} ml` },
              { name: "Salt", amount: `${drink.saltG.toFixed(2)} g` },
              { name: "Water", amount: `top up to ${bottleMl} ml` },
            ].map((row, i) => (
              <View key={row.name} style={[styles.ingredientRow, i > 0 && styles.ingredientRowDivider]}>
                <Text style={styles.ingredientName}>{row.name}</Text>
                <Text style={styles.ingredientAmount}>{row.amount}</Text>
              </View>
            ))}
          </Card>

          <View style={styles.totalsRow}>
            {[
              { label: "Carbs", value: `${drink.carbsG.toFixed(0)} g`, gold: true },
              { label: "Sodium", value: `${drink.sodiumTotalMg} mg` },
              { label: "Nitrate", value: `${drink.nitrateMg} mg` },
              { label: "Energy", value: `${drink.calories} kcal` },
            ].map((cell) => (
              <Card key={cell.label} style={styles.totalCell}>
                <Text style={styles.totalLabel}>{cell.label}</Text>
                <Text style={[styles.totalValue, cell.gold && { color: Color.gold }]}>{cell.value}</Text>
              </Card>
            ))}
          </View>

          <View style={[styles.sodiumBadge, { borderColor: badge.border, backgroundColor: badge.bg }]}>
            <View style={[styles.sodiumDot, { backgroundColor: badge.dot }]} />
            <Text style={[styles.sodiumBadgeText, { color: badge.text }]}>
              {drink.sodiumBadge === "optimal" ? "Optimal hydration range" : drink.sodiumBadge === "high" ? "High-sodium profile" : "Below recommended range"}
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>DRINKING PLAN</Text>
          <Text style={styles.hintText}>
            <Text style={{ fontWeight: "600", color: Color.textPrimary }}>{sportCfg.runMode ? "Carry: " : "Bottle: "}</Text>
            {plan.bottleAdvice}
          </Text>
          <View style={styles.phasesGrid}>
            {plan.phases.map((cell) => (
              <Card key={cell.label} style={styles.phaseCell}>
                <Text style={styles.phaseLabel}>{cell.label}</Text>
                <Text style={styles.phaseAmount}>{cell.amount}</Text>
                <Text style={styles.phaseTip}>{cell.tip}</Text>
              </Card>
            ))}
          </View>
          {plan.extra ? <Text style={styles.extraText}>{plan.extra}</Text> : null}

          <Pressable
            onPress={() => setBenefitsOpen((o) => !o)}
            style={[styles.benefitsHeader, { marginTop: Spacing.lg }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitsTitle}>Ingredient benefits</Text>
              <Text style={styles.benefitsSubtitle}>What each ingredient does and why it&apos;s in your bottle</Text>
            </View>
            <Ionicons name={benefitsOpen ? "chevron-up" : "chevron-down"} size={16} color={Color.textFaint} />
          </Pressable>

          {benefitsOpen
            ? INGREDIENT_BENEFITS.map((item) => {
                const open = openBenefit === item.name;
                return (
                  <Card key={item.name} style={styles.benefitCard}>
                    <Pressable onPress={() => setOpenBenefit(open ? null : item.name)} style={styles.benefitRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.benefitNameRow}>
                          <Text style={styles.benefitName}>{item.name}</Text>
                          <View style={styles.benefitTag}>
                            <Text style={styles.benefitTagText}>{item.tag}</Text>
                          </View>
                        </View>
                        <Text style={styles.benefitSummary}>{item.summary}</Text>
                      </View>
                      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={Color.textFaint} />
                    </Pressable>
                    {open ? (
                      <View style={styles.benefitDetail}>
                        <Text style={styles.benefitDetailText}>
                          <Text style={styles.benefitDetailLabel}>What it is: </Text>
                          {item.whatItIs}
                        </Text>
                        <Text style={styles.benefitDetailText}>
                          <Text style={styles.benefitDetailLabel}>Why it helps: </Text>
                          {item.whyItHelps}
                        </Text>
                        <Text style={styles.benefitDetailText}>{item.detail}</Text>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            : null}

          <Text style={styles.footerNote}>
            Guidance for healthy adult athletes — not medical or dietetic advice. Trial the mix in training before
            using it on match or race day.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.bg0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Color.textPrimary },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorText: { color: Color.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: Color.textMuted, marginBottom: 6, marginTop: Spacing.md, textTransform: "uppercase", letterSpacing: 0.4 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted, marginBottom: Spacing.sm },
  gridRow: { flexDirection: "row", gap: Spacing.sm },
  textInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Color.textPrimary,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  presetChip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.borderSubtle, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  presetChipActive: { borderColor: Color.gold, backgroundColor: Color.goldWeak },
  presetChipText: { fontSize: 11, fontWeight: "500", color: Color.textMuted },
  presetChipTextActive: { color: Color.gold },
  hintText: { fontSize: 11, color: Color.textMuted, marginTop: Spacing.sm, lineHeight: 16 },
  hintTextSmall: { fontSize: 10, color: Color.textFaint, marginTop: 4, lineHeight: 14 },
  durationBox: { borderRadius: Radius.md, borderWidth: 1, borderColor: Color.borderSubtle, backgroundColor: Color.surface1, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  durationValue: { fontSize: 14, fontWeight: "600", color: Color.textPrimary },
  durationSub: { fontSize: 9, color: Color.textFaint, marginTop: 2 },
  infoCard: { padding: Spacing.md, marginTop: Spacing.md },
  infoText: { fontSize: 11, color: Color.textMuted, lineHeight: 16 },
  infoTextGold: { fontSize: 11, color: Color.gold, fontWeight: "600", marginTop: Spacing.xs, lineHeight: 16 },
  mixedForText: { fontSize: 10, color: Color.textFaint, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  ingredientsCard: { padding: 0 },
  ingredientRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  ingredientRowDivider: { borderTopWidth: 1, borderTopColor: Color.borderSubtle },
  ingredientName: { fontSize: 13, color: Color.textSecondary },
  ingredientAmount: { fontSize: 13, fontWeight: "600", color: Color.textPrimary },
  totalsRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm },
  totalCell: { flex: 1, padding: Spacing.sm, alignItems: "center" },
  totalLabel: { fontSize: 9, fontWeight: "700", color: Color.textMuted, textTransform: "uppercase" },
  totalValue: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
  sodiumBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 6, marginTop: Spacing.md },
  sodiumDot: { width: 6, height: 6, borderRadius: 3 },
  sodiumBadgeText: { fontSize: 11, fontWeight: "600" },
  phasesGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  phaseCell: { flexGrow: 1, flexBasis: "30%", padding: Spacing.sm, alignItems: "center" },
  phaseLabel: { fontSize: 9, fontWeight: "700", color: Color.textMuted, textTransform: "uppercase" },
  phaseAmount: { fontSize: 13, fontWeight: "700", color: Color.textPrimary, marginTop: 4 },
  phaseTip: { fontSize: 9, color: Color.textFaint, marginTop: 2, textAlign: "center" },
  extraText: { fontSize: 11, color: Color.warning, marginTop: Spacing.sm, lineHeight: 16 },
  footerNote: { fontSize: 11, color: Color.textFaint, marginTop: Spacing.xl, lineHeight: 16 },
  benefitsHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm },
  benefitsTitle: { fontSize: 14, fontWeight: "700", color: Color.textPrimary },
  benefitsSubtitle: { fontSize: 11, color: Color.textMuted, marginTop: 2 },
  benefitCard: { padding: Spacing.sm, marginTop: Spacing.xs },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  benefitNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flexWrap: "wrap" },
  benefitName: { fontSize: 13, fontWeight: "700", color: Color.textPrimary },
  benefitTag: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Color.goldBorder, backgroundColor: Color.goldWeak, paddingHorizontal: 8, paddingVertical: 2 },
  benefitTagText: { fontSize: 10, fontWeight: "600", color: Color.gold },
  benefitSummary: { fontSize: 11, color: Color.textMuted, marginTop: 4, lineHeight: 15 },
  benefitDetail: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Color.borderSubtle, gap: Spacing.xs },
  benefitDetailText: { fontSize: 11, color: Color.textMuted, lineHeight: 16 },
  benefitDetailLabel: { fontWeight: "600", color: Color.textSecondary },
});
