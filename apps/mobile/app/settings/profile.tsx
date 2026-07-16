import { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { API_URL } from '../../src/lib/env';
import { TextField } from '../../src/components/ui/TextField';
import { Button } from '../../src/components/ui/Button';

async function fetchProfile() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load profile');
  }

  const json = await response.json();
  return json.user.profile;
}

export default function EditProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { fullName: string; phone: string }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Failed to update profile');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Sukses', 'Profil Anda berhasil diperbarui.');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Gagal', err.message);
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#f472b6" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center p-6">
        <Text className="text-red-400">Gagal memuat profil.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950 p-6">
      <Stack.Screen options={{ title: 'Edit Profil' }} />
      <Text className="text-2xl font-bold text-white mb-6">Ubah Profil Anda</Text>

      <View className="space-y-4">
        <TextField
          label="Nama Lengkap"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Masukkan nama lengkap"
        />

        <TextField
          label="Nomor Telepon"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Masukkan nomor telepon"
        />
      </View>

      <Button
        title={updateMutation.status === 'pending' ? 'Menyimpan...' : 'Simpan Perubahan'}
        onPress={() => updateMutation.mutate({ fullName, phone })}
        disabled={updateMutation.status === 'pending' || !fullName.trim()}
        className="mt-8"
      />
    </View>
  );
}
