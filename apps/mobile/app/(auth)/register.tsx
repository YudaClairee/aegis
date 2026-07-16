import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Alert, View, Text } from 'react-native';
import { TextField } from '../../src/components/ui/TextField';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/hooks/useAuth';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, loading, error, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    router.replace('/(tabs)');
    return null;
  }

  const handleSubmit = async () => {
    const result = await signUp(email, password);
    if (!result.error) {
      Alert.alert('Akun dibuat', 'Silakan cek email Anda untuk verifikasi jika diperlukan.');
      router.replace('/(auth)/login');
    } else {
      Alert.alert('Pendaftaran gagal', result.error);
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 py-10">
      <Text className="text-3xl font-bold text-white">Buat akun Aegis</Text>
      <Text className="text-slate-300 mt-3">Daftar untuk mulai melindungi diri Anda dan keluarga.</Text>

      <View className="mt-8 space-y-4">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
        />
        <TextField
          label="Kata sandi"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minimal 6 karakter"
        />
      </View>

      {error ? <Text className="text-red-400 mt-4">{error}</Text> : null}

      <Button
        title={loading ? 'Memproses...' : 'Daftar'}
        onPress={handleSubmit}
        disabled={loading || !email || !password}
        className="mt-8"
      />

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-slate-400">Sudah punya akun?</Text>
        <Link href="/(auth)/login" asChild>
          <Text className="text-pink-400">Masuk</Text>
        </Link>
      </View>
    </View>
  );
}
