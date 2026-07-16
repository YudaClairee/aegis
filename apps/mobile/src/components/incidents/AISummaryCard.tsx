import { View, Text } from 'react-native';
import React from 'react';
import { AISummary } from '@aegis/shared';

export function AISummaryCard({ summary }: { summary: AISummary }) {
  return (
    <View className="rounded-3xl bg-slate-900 p-5 mb-4">
      <Text className="text-lg font-semibold text-white">AI Summary</Text>
      <View className="mt-3 space-y-2">
        <Text className="text-slate-300">Risk: {summary.risk}/100</Text>
        <Text className="text-slate-300">Classification: {summary.classification}</Text>
        <Text className="text-slate-300">Recommendation: {summary.recommendation}</Text>
        <Text className="text-slate-300">Confidence: {(summary.confidence * 100).toFixed(0)}%</Text>
        <Text className="text-slate-300">Keywords: {summary.keywords_detected.join(', ') || 'Tidak ada'}</Text>
      </View>
      <View className="mt-4 rounded-2xl bg-slate-950 p-4">
        <Text className="text-slate-200">{summary.summary}</Text>
      </View>
    </View>
  );
}
