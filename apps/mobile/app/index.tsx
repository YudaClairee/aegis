import { Text, View } from 'react-native';
import { VERSION } from '@aegis/shared';

export default function Page() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-900">
      <Text className="text-2xl font-bold text-pink-500">🛡️ Aegis Monorepo</Text>
      <Text className="text-slate-400 mt-2">Shared Lib Version: {VERSION}</Text>
    </View>
  );
}
