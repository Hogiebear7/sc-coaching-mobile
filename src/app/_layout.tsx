import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Color, Radius, Spacing } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { clearLastCrash, getLastCrash, installGlobalCrashHandler, type CrashRecord } from "@/lib/crash-log";
import { addNotificationTapListener, mapLinkHrefToRoute } from "@/lib/push-notifications";
import { RestTimerProvider } from "@/lib/rest-timer";
import { WorkoutDraftProvider } from "@/lib/workout-draft";

SplashScreen.preventAutoHideAsync();
installGlobalCrashHandler();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Route-gates the whole app on auth status: signed-out users are always
// bounced to (auth), signed-in users away from it. Mirrors the web app's
// server-side session check in the dashboard layout, just done client-side
// here since there's no server-rendering equivalent on native.
function AuthGate() {
  const { status, user, viewMode } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isStaffRole = !!user && user.role !== "member";
  // A staff/coach account can opt into the member tab group once they have
  // a ProfileRecord (see provision-member-profile) — viewMode tracks that
  // choice. Plain members have no staff group to switch to, so it's a no-op
  // for them.
  const wantsStaffGroup = isStaffRole && viewMode === "coach";

  useEffect(() => {
    if (status === "loading") return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const inStaffGroup = segments[0] === "(staff)";

    if (status === "signedOut") {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    if (inAuthGroup) {
      router.replace((wantsStaffGroup ? "/(staff)" : "/(tabs)") as never);
    } else if (wantsStaffGroup && inTabsGroup) {
      router.replace("/(staff)" as never);
    } else if (!wantsStaffGroup && inStaffGroup) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router, wantsStaffGroup]);

  // Tapping a delivered notification (app backgrounded/killed) navigates
  // straight to the relevant screen, mirroring the web app's push linkHref.
  useEffect(() => {
    if (status !== "signedIn") return;
    return addNotificationTapListener((linkHref) => {
      router.push(mapLinkHrefToRoute(linkHref) as never);
    });
  }, [status, router]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Color.gold} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Color.bg0 } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(staff)" />
      <Stack.Screen name="membership" options={{ presentation: "card" }} />
      <Stack.Screen name="messages" options={{ presentation: "card" }} />
      <Stack.Screen name="notifications" options={{ presentation: "card" }} />
      <Stack.Screen name="exercise-library-detail" options={{ presentation: "card" }} />
      <Stack.Screen name="profile" options={{ presentation: "card" }} />
      <Stack.Screen name="settings" options={{ presentation: "card" }} />
      <Stack.Screen name="staff-member" options={{ presentation: "card" }} />
      <Stack.Screen name="staff-message-thread" options={{ presentation: "card" }} />
      <Stack.Screen name="staff-program-builder" options={{ presentation: "card" }} />
      <Stack.Screen name="staff-nutrition-target" options={{ presentation: "card" }} />
      <Stack.Screen name="class-workout-builder" options={{ presentation: "card" }} />
      <Stack.Screen name="workout-library" options={{ presentation: "card" }} />
      <Stack.Screen name="workout-generator" options={{ presentation: "card" }} />
      <Stack.Screen name="workout-template-builder" options={{ presentation: "card" }} />
      <Stack.Screen name="workout-history" options={{ presentation: "card" }} />
      <Stack.Screen name="workout-archive" options={{ presentation: "card" }} />
      <Stack.Screen name="log-workout" options={{ presentation: "modal" }} />
      <Stack.Screen name="log-food" options={{ presentation: "modal" }} />
      <Stack.Screen name="barcode-scan" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="label-scan" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="custom-food" options={{ presentation: "modal" }} />
      <Stack.Screen name="my-foods" options={{ presentation: "card" }} />
      <Stack.Screen name="submit-food" options={{ presentation: "card" }} />
      <Stack.Screen name="plate-calculator" options={{ presentation: "modal" }} />
      <Stack.Screen name="rest-timer" options={{ presentation: "modal" }} />
      <Stack.Screen name="run-timer" options={{ presentation: "modal" }} />
      <Stack.Screen name="format-timer" options={{ presentation: "modal" }} />
      <Stack.Screen name="drink-calculator" options={{ presentation: "card" }} />
    </Stack>
  );
}

// Diagnostic-only: shows whatever installGlobalCrashHandler() captured from
// the app's last fatal JS error, so it can be read/screenshotted and sent
// back rather than lost the moment the app terminates. Blocks the rest of
// the app behind "Dismiss" so it's impossible to miss after a crash.
function CrashViewer({ crash, onDismiss }: { crash: CrashRecord; onDismiss: () => void }) {
  return (
    <View style={styles.crashRoot}>
      <ScrollView contentContainerStyle={styles.crashScroll}>
        <Text style={styles.crashTitle}>The app crashed last time it was open</Text>
        <Text style={styles.crashSubtitle}>
          {new Date(crash.timestamp).toLocaleString()} · Screenshot this and send it over so it can be fixed.
        </Text>
        <View style={styles.crashBox}>
          <Text style={styles.crashLabel}>MESSAGE</Text>
          <Text style={styles.crashText}>{crash.message}</Text>
          {crash.stack ? (
            <>
              <Text style={[styles.crashLabel, { marginTop: Spacing.md }]}>STACK</Text>
              <Text style={styles.crashText}>{crash.stack}</Text>
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.crashFooter}>
        <Button title="Dismiss" onPress={onDismiss} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [lastCrash, setLastCrash] = useState<CrashRecord | null | undefined>(undefined);

  useEffect(() => {
    getLastCrash().then(setLastCrash);
  }, []);

  if (lastCrash) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Color.bg0} />
        <CrashViewer
          crash={lastCrash}
          onDismiss={() => {
            void clearLastCrash();
            setLastCrash(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WorkoutDraftProvider>
            <RestTimerProvider>
              <StatusBar barStyle="light-content" backgroundColor={Color.bg0} />
              <View style={styles.root}>
                <AuthGate />
              </View>
            </RestTimerProvider>
          </WorkoutDraftProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Color.bg0,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.bg0,
  },
  crashRoot: { flex: 1, backgroundColor: Color.bg0 },
  crashScroll: { padding: Spacing.lg, paddingTop: Spacing.xxl },
  crashTitle: { fontSize: 18, fontWeight: "700", color: Color.textPrimary },
  crashSubtitle: { fontSize: 12, color: Color.textMuted, marginTop: Spacing.xs, lineHeight: 17 },
  crashBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Color.borderSubtle,
    backgroundColor: Color.surface1,
  },
  crashLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: Color.textMuted },
  crashText: { fontSize: 12, color: Color.textSecondary, marginTop: Spacing.xs, fontFamily: "monospace" },
  crashFooter: { padding: Spacing.lg },
});
