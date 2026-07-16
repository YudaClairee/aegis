import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/providers/AuthProvider';
import { useAuth } from '../src/hooks/useAuth';
import { queryClient } from '../src/lib/query-client';
import { useNetworkStore } from '../src/stores/network-store';
import { registerForPushNotificationsAsync } from '../src/services/notifications';
import '../global.css';

function AppContent() {
  const isConnected = useNetworkStore((state) => state.isConnected);
  const initNetworkStatus = useNetworkStore((state) => state.initNetworkStatus);
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = initNetworkStatus();
    return () => unsubscribe();
  }, [initNetworkStatus]);

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  return (
    <View className="flex-1">
      {!isConnected ? (
        <View className="bg-rose-600 px-4 py-2 pt-12 items-center justify-center">
          <Text className="text-white font-semibold text-xs">⚠️ Koneksi terputus. Mode Offline Aktif.</Text>
        </View>
      ) : null}
      <Slot />
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
