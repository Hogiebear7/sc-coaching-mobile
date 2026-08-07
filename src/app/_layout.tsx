import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Color } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { addNotificationTapListener, mapLinkHrefToRoute } from "@/lib/push-notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Route-gates the whole app on auth status: signed-out users are always
// bounced to (auth), signed-in users away from it. Mirrors the web app's
// server-side session check in the dashboard layout, just done client-side
// here since there's no server-rendering equivalent on native.
function AuthGate() {
  const { status, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isStaffRole = !!user && user.role !== "member";

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

    // signedIn — coaches/admins don't have a ProfileRecord (profiles are
    // member-owned), so they get an entirely separate tab group rather than
    // the member (tabs) screens, which all assume a profile exists.
    if (inAuthGroup) {
      router.replace((isStaffRole ? "/(staff)" : "/(tabs)") as never);
    } else if (isStaffRole && inTabsGroup) {
      router.replace("/(staff)" as never);
    } else if (!isStaffRole && inStaffGroup) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router, isStaffRole]);

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
      <Stack.Screen name="profile" options={{ presentation: "card" }} />
      <Stack.Screen name="staff-member" options={{ presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar barStyle="light-content" backgroundColor={Color.bg0} />
          <View style={styles.root}>
            <AuthGate />
          </View>
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
});
