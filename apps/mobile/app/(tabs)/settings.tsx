import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../../src/components/ui/Button';

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <View className="flex-1 bg-slate-950 p-6">
      <Text className="text-3xl font-bold text-white mb-8">Pengaturan</Text>

      <View className="space-y-4 mb-8">
        <Pressable
          onPress={() => router.push('/settings/profile')}
          className="flex-row items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-5 active:bg-slate-800"
        >
          <View className="flex-row items-center space-x-3">
            <Text className="text-2xl">👤</Text>
            <View>
              <Text className="text-lg font-semibold text-white">Edit Profil</Text>
              <Text className="text-xs text-slate-400">Ubah nama dan nomor telepon Anda</Text>
            </View>
          </View>
          <Text className="text-slate-400 text-lg font-bold">➡️</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings/contacts')}
          className="flex-row items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-5 active:bg-slate-800"
        >
          <View className="flex-row items-center space-x-3">
            <Text className="text-2xl">📞</Text>
            <View>
              <Text className="text-lg font-semibold text-white">Kontak Darurat</Text>
              <Text className="text-xs text-slate-400">Atur kontak utama untuk situasi bahaya</Text>
            </View>
          </View>
          <Text className="text-slate-400 text-lg font-bold">➡️</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings/family')}
          className="flex-row items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-5 active:bg-slate-800"
        >
          <View className="flex-row items-center space-x-3">
            <Text className="text-2xl">🛡️</Text>
            <View>
              <Text className="text-lg font-semibold text-white">Pendampingan Keluarga</Text>
              <Text className="text-xs text-slate-400">Jaga keluarga Anda / terima kode undangan</Text>
            </View>
          </View>
          <Text className="text-slate-400 text-lg font-bold">➡️</Text>
        </Pressable>
      </View>

      <View className="mt-auto">
        <Button title="Keluar dari Akun" variant="secondary" onPress={signOut} />
      </View>
    </View>
  );
}
