import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/providers/AuthProvider';
import { queryClient } from '../src/lib/query-client';
import '../global.css';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
