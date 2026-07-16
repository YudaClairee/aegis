import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../../src/components/ui/Button';

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // no-op: routing is handled by the root layout or auth screen
    }
  }, [user, loading]);

  return (
    <View className="flex-1 bg-slate-950 px-6 py-10">
      <Text className="text-3xl font-bold text-white">Halo, {user?.email ?? 'Pengguna'}!</Text>
      <Text className="text-slate-300 mt-3">Selamat datang di SafeHer. Semua proteksi utama akan diluncurkan di sini.</Text>

      <View className="mt-8 space-y-4 rounded-3xl border border-slate-700 bg-slate-900 p-5">
        <Text className="text-lg font-semibold text-white">Status Guardian</Text>
        <Text className="text-slate-400 mt-2">Guardian mode akan menampilkan status sensor, hitungan risiko, dan tombol SOS di versi berikutnya.</Text>
      </View>

      <Button title="Keluar" variant="secondary" onPress={signOut} className="mt-8" />
    </View>
  );
}
