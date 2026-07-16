import { Text, View } from 'react-native';
import React from 'react';
import { RiskLevel } from '../../stores/guardian-store';

const badgeStyles: Record<RiskLevel, string> = {
  low: 'bg-emerald-500 text-emerald-950',
  medium: 'bg-amber-500 text-amber-950',
  high: 'bg-orange-500 text-orange-950',
  critical: 'bg-pink-500 text-white',
};

export function RiskLevelIndicator({ riskLevel, score }: { riskLevel: RiskLevel; score: number }) {
  return (
    <View className="rounded-3xl bg-slate-900 p-4">
      <Text className="text-sm font-semibold uppercase text-slate-400">Risk Level</Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">{riskLevel}</Text>
        <View className={`rounded-full px-4 py-2 ${badgeStyles[riskLevel]}`}>
          <Text className="font-semibold">{score}</Text>
        </View>
      </View>
    </View>
  );
}
