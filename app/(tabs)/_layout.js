import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
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
      <Tabs.Screen name="log/activities" options={{ href: null }} />
      <Tabs.Screen name="log/sleep" options={{ href: null }} />
      <Tabs.Screen name="log/foodintake/food" options={{ href: null }} />
      <Tabs.Screen name="account/account" options={{ href: null }} />
      <Tabs.Screen name="account/accountdetails" options={{ href: null }} />
      <Tabs.Screen name="account/subscription" options={{ href: null }} />
    </Tabs>
  );
}