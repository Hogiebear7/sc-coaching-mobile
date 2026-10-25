import { useRouter } from "expo-router";

import { ChartDetail } from "@/components/app/ChartDetail";
import { useBodyWeightLogs } from "@/lib/queries/body-weight";
import { useAppTheme } from "@/lib/theme";

// Body-weight chart detail: raw weigh-ins as a thin line with the smoothed
// trend on top, so a salty dinner doesn't read as a setback.
export default function WeightTrendScreen() {
  const router = useRouter();
  const { data: dc } = useAppTheme();
  const { data, isLoading, isError, refetch } = useBodyWeightLogs();
  const points = (data ?? []).map((w) => ({ id: w.id, date: w.date, value: w.weightKg }));

  return (
    <ChartDetail
      title="Weight trend"
      points={points}
      loading={isLoading}
      error={isError}
      onRetry={() => refetch()}
      kind="line"
      unit="kg"
      color={dc.weight}
      format={(v) => v.toFixed(1)}
      legend={[
        { color: `${dc.weight}73`, label: "Scale weight", dashed: true },
        { color: dc.weight, label: "Trend weight", dashed: true },
      ]}
      explainer={{
        title: "Why a trend?",
        body:
          "Day-to-day scale weight swings with water, salt, carbs and timing. The trend line smooths those swings out so you can see where your weight is really heading. Weigh in at the same time each day, ideally in the morning, for the cleanest trend.",
      }}
      emptyText="No weigh-ins yet. Add one from your profile."
      action={{ label: "Log a weigh-in", onPress: () => router.push("/profile") }}
      defaultRange="3M"
    />
  );
}
