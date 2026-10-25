import { Stack } from "expo-router";

import { useLegacyColors } from "@/lib/theme";

export default function AuthLayout() {
  const Color = useLegacyColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Color.bg0 },
      }}
    />
  );
}
