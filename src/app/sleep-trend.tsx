import { useRouter } from "expo-router";

import { ChartDetail } from "@/components/app/ChartDetail";
import { useRecovery } from "@/lib/queries/recovery";
import { useAppTheme } from "@/lib/theme";

// Sleep-hours chart detail, from the daily recovery check-in.
export default function SleepTrendScreen() {
  const router = useRouter();
  const { data: dc } = useAppTheme();
  const { data, isLoading, isError, refetch } = useRecovery();
  const points = (data?.logs ?? [])
    .filter((l) => l.sleepHours != null)
    .map((l) => ({ id: l.id, date: l.date, value: l.sleepHours as number }));

  return (
    <ChartDetail
      title="Sleep"
      points={points}
      loading={isLoading}
      error={isError || (!isLoading && !data)}
      onRetry={() => refetch()}
      kind="bars"
      unit="h"
      domain={[0, 12]}
      color={dc.sleep}
      format={(v) => (Math.round(v * 10) / 10).toString()}
      explainer={{
        title: "How much is enough?",
        body:
          "Most people training hard do best on 7–9 hours. A consistent wake time matters as much as the total. Sleep counts for a quarter of your readiness score.",
      }}
      emptyText="Add sleep hours to your daily check-in to see this."
      action={{ label: "Log today's check-in", onPress: () => router.push("/(tabs)/recovery") }}
    />
  );
}
