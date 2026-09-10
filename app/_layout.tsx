import { brand } from "@/constants/brand";
import { ActivityProvider } from "@/contexts/activity-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { FoodProvider } from "@/contexts/food-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { SleepProvider } from "@/contexts/sleep-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

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
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
<AuthProvider>
  <ProfileProvider>
    <ActivityProvider>
      <SleepProvider>
        <FoodProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </FoodProvider>
      </SleepProvider>
    </ActivityProvider>
  </ProfileProvider>
</AuthProvider>
  );
}