import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#48DDB0',
        tabBarInactiveTintColor: '#60766E',
        tabBarStyle: {
          backgroundColor: '#07140F',
          borderTopColor: '#123B2F',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8 + insets.top,
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="homepage"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => <Ionicons name="create-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insight"
        options={{
          title: 'Insight',
          tabBarIcon: ({ color }) => <Ionicons name="sparkles-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen name="account/account" options={{ href: null }} />
      <Tabs.Screen name="account/accountdetails" options={{ href: null }} />
      <Tabs.Screen name="account/subscription" options={{ href: null }} />
    </Tabs>
  );
}