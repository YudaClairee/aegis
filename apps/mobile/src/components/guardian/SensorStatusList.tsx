import { View, Text } from 'react-native';
import React from 'react';

type SensorStatus = {
  label: string;
  active: boolean;
};

export function SensorStatusList({ statuses }: { statuses: SensorStatus[] }) {
  return (
    <View className="rounded-3xl bg-slate-900 p-4">
      <Text className="text-sm font-semibold uppercase text-slate-400">Sensor Status</Text>
      <View className="mt-3 space-y-3">
        {statuses.map((status) => (
          <View key={status.label} className="flex-row items-center justify-between">
            <Text className="text-slate-200">{status.label}</Text>
            <View
              className={`rounded-full px-3 py-1 ${status.active ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <Text className="text-xs text-slate-950">{status.active ? 'On' : 'Off'}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
