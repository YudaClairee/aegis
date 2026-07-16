import { useState } from 'react';
import { Link, useRouter, Redirect } from 'expo-router';
import { Alert, View, Text } from 'react-native';
import { TextField } from '../../src/components/ui/TextField';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading, error, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = async () => {
    const result = await signIn(email, password);
    if (!result.error) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Login gagal', result.error);
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 py-10">
      <Text className="text-3xl font-bold text-white">Masuk ke Aegis</Text>
      <Text className="text-slate-300 mt-3">Aman di setiap langkah. Login untuk mulai proteksi.</Text>

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
          placeholder="Masukkan kata sandi"
        />
      </View>

      {error ? <Text className="text-red-400 mt-4">{error}</Text> : null}

      <Button
        title={loading ? 'Memproses...' : 'Masuk'}
        onPress={handleSubmit}
        disabled={loading || !email || !password}
        className="mt-8"
      />

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-slate-400">Belum punya akun?</Text>
        <Link href="/(auth)/register" asChild>
          <Text className="text-pink-400">Daftar sekarang</Text>
        </Link>
      </View>
    </View>
  );
}
