import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { brand } from "@/constants/brand";
import { ActivityProvider } from "@/contexts/activity-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SleepProvider } from "@/contexts/sleep-context";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: brand.background,
        }}
      >
        <ActivityIndicator color={brand.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={true}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={false}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
<AuthProvider>
  <ActivityProvider>
    <SleepProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </SleepProvider>
  </ActivityProvider>
</AuthProvider>
  );
}