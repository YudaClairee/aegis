import { View, Text } from 'react-native';
import { Button } from '../ui/Button';
import React from 'react';

interface CountdownOverlayProps {
  seconds: number;
  onCancel: () => void;
  triggerType: string | null;
}

export function CountdownOverlay({ seconds, onCancel, triggerType }: CountdownOverlayProps) {
  return (
    <View className="absolute inset-0 bg-slate-950/95 p-6 justify-center">
      <View className="rounded-3xl border border-pink-500 bg-slate-900 p-6 shadow-xl">
        <Text className="text-2xl font-bold text-white">SOS akan dikirim</Text>
        <Text className="mt-3 text-slate-300">{triggerType === 'manual' ? 'Manual SOS' : 'Auto SOS'} akan dikirim dalam:</Text>
        <Text className="text-6xl font-extrabold text-pink-400 mt-6">{seconds}</Text>
        <View className="mt-8">
          <Button title="Batalkan" onPress={onCancel} variant="secondary" />
        </View>
      </View>
    </View>
  );
}
