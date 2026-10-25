import { useRouter } from "expo-router";

import { ChartDetail } from "@/components/app/ChartDetail";
import { readinessColor } from "@/constants/theme";
import { useRecovery } from "@/lib/queries/recovery";
import { useAppTheme } from "@/lib/theme";

// Readiness chart detail — the first user of the shared ChartDetail template.
export default function ReadinessScreen() {
  const router = useRouter();
  const { colors, data: dc } = useAppTheme();
  const { data, isLoading, isError, refetch } = useRecovery();
  const points = (data?.logs ?? [])
    .filter((l) => l.readinessScore !== null)
    .map((l) => ({ id: l.id, date: l.date, value: l.readinessScore as number }));

  return (
    <ChartDetail
      title="Readiness"
      points={points}
      loading={isLoading}
      error={isError || (!isLoading && !data)}
      onRetry={() => refetch()}
      kind="bars"
      domain={[0, 100]}
      color={dc.readinessHigh}
      colorFor={(v) => readinessColor(v, dc, colors.textMuted)}
      legend={[
        { color: dc.readinessHigh, label: "Ready 60+" },
        { color: dc.readinessMid, label: "Steady 40–59" },
        { color: dc.readinessLow, label: "Ease off <40" },
      ]}
      explainer={{
        title: "What is readiness?",
        body:
          "A score out of 100 from your daily check-in: sleep hours, sleep quality, soreness and fatigue each count for up to 25 points. Higher means you're better recovered to train hard.",
      }}
      emptyText="Log a check-in from + to start your trend."
      action={{ label: "Log today's check-in", onPress: () => router.push("/(tabs)/recovery") }}
    />
  );
}
