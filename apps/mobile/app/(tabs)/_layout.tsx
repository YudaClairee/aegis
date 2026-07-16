import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#0f172a' },
        tabBarActiveTintColor: '#f472b6',
        tabBarInactiveTintColor: '#cbd5e1',
      }}
    />
  );
}
