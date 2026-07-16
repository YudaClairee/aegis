import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../src/hooks/useAuth';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/(tabs)' : '/(auth)/login');
    }
  }, [loading, user, router]);

  return (
    <View className="flex-1 justify-center items-center bg-slate-950">
      <ActivityIndicator size="large" color="#f472b6" />
      <Text className="mt-4 text-slate-300">Memuat aplikasi...</Text>
    </View>
  );
}
