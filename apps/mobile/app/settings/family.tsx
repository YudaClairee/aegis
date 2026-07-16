import { useState } from 'react';
import { View, Text, Alert, ActivityIndicator, FlatList, Pressable, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { useContactLinks } from '../../src/hooks/useContactLinks';
import { Button } from '../../src/components/ui/Button';

export default function FamilyPage() {
  const {
    links,
    isLoadingLinks,
    isLinksError,
    linksError,
    refetchLinks,
    acceptInviteCode,
    isAcceptingInvite,
    revokeLink,
    isRevokingLink,
  } = useContactLinks();

  const [inviteCode, setInviteCode] = useState('');

  const handleAccept = async () => {
    if (!inviteCode.trim() || inviteCode.trim().length !== 8) {
      Alert.alert('Error', 'Kode undangan harus terdiri dari 8 karakter.');
      return;
    }

    try {
      const res = await acceptInviteCode(inviteCode.trim().toUpperCase());
      Alert.alert('Berhasil Terhubung', `Anda sekarang menjadi pendamping keselamatan untuk ${res.linkedTo.fullName}.`);
      setInviteCode('');
    } catch (err: any) {
      Alert.alert('Gagal Menghubungkan', err.message || 'Kode undangan tidak valid.');
    }
  };

  const handleRevoke = (linkId: string, name: string) => {
    Alert.alert(
      'Hapus Hubungan',
      `Apakah Anda yakin ingin berhenti mendampingi ${name}? Anda tidak akan menerima notifikasi SOS dari mereka lagi.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeLink(linkId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message || 'Gagal menghapus hubungan');
            }
          },
        },
      ]
    );
  };

  if (isLoadingLinks) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#f472b6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950 p-6">
      <Stack.Screen options={{ title: 'Pendampingan Keluarga' }} />

      <Text className="text-2xl font-bold text-white mb-2">Pendampingan Keluarga</Text>
      <Text className="text-slate-400 text-sm mb-6 leading-relaxed">
        Hubungkan HP Anda sebagai pendamping untuk menerima notifikasi real-time dan melacak lokasi anggota keluarga saat mereka berada dalam bahaya.
      </Text>

      {/* Input Invite Code Form */}
      <View className="rounded-3xl border border-slate-800 bg-slate-900 p-5 mb-8">
        <Text className="text-sm font-semibold uppercase text-slate-400 mb-3">Hubungkan HP Keluarga Baru</Text>
        <View className="flex-row space-x-3 items-center">
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Masukkan Kode (cth: ABCD1234)"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            maxLength={8}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-white font-mono font-semibold"
          />
          <Pressable
            onPress={handleAccept}
            disabled={isAcceptingInvite}
            className="bg-pink-500 rounded-2xl px-5 py-4 items-center justify-center active:bg-pink-600 disabled:bg-pink-700/50"
          >
            {isAcceptingInvite ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">Hubungkan</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Text className="text-lg font-bold text-white mb-4">Daftar Anggota Keluarga yang Dijaga</Text>

      {isLinksError ? (
        <View className="rounded-3xl bg-red-950/50 p-5 mb-4 border border-red-800">
          <Text className="text-red-300 text-center">{linksError?.message ?? 'Gagal memuat daftar pendampingan.'}</Text>
        </View>
      ) : null}

      <FlatList
        data={links}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="rounded-3xl border border-slate-800 bg-slate-900 p-5 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{item.victim?.fullName || item.name}</Text>
                <Text className="text-slate-400 text-sm mt-1">{item.victim?.phone || 'No phone'}</Text>
                <Text className="text-xs text-slate-500 mt-2 bg-slate-800 self-start px-2.5 py-1 rounded-full">
                  🏷️ Hubungan: {item.relationship || 'Keluarga'}
                </Text>
              </View>

              <Pressable
                onPress={() => handleRevoke(item.id, item.victim?.fullName || item.name)}
                disabled={isRevokingLink}
                className="px-3.5 py-2.5 bg-rose-950 rounded-2xl active:bg-rose-900 border border-rose-900/30"
              >
                <Text className="text-xs text-rose-300 font-semibold">Hapus</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="rounded-3xl bg-slate-900 border border-slate-800 p-8 items-center mt-2">
            <Text className="text-slate-300 font-medium text-center">Belum menjaga siapapun</Text>
            <Text className="text-slate-500 text-xs text-center mt-2 leading-relaxed">
              Minta kode undangan dari HP keluarga Anda (melalui menu Pengaturan &gt; Kontak Darurat &gt; Hubungkan HP), lalu masukkan kodenya di atas.
            </Text>
          </View>
        }
      />
    </View>
  );
}
