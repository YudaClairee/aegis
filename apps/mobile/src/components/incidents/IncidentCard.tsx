import { View, Text, Pressable } from 'react-native';
import React from 'react';
import { Incident } from '../../hooks/useIncidents';

const statusStyles: Record<Incident['status'], string> = {
  triggered: 'bg-rose-500',
  active: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  false_alarm: 'bg-slate-500',
};

export function IncidentCard({ incident, onPress }: { incident: Incident; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-3xl bg-slate-900 p-5 mb-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-semibold text-white">{incident.triggerType}</Text>
        <View className={`rounded-full px-3 py-1 ${statusStyles[incident.status]}`}>
          <Text className="text-xs font-semibold text-slate-950">{incident.status}</Text>
        </View>
      </View>
      <Text className="mt-3 text-slate-300">Risk score: {incident.riskScore}</Text>
      <Text className="mt-1 text-slate-300">
        {incident.classification ?? 'Classification belum tersedia'}
      </Text>
      <Text className="mt-4 text-slate-400 text-sm">
        {new Date(incident.createdAt).toLocaleString()}
      </Text>
      {incident.location?.latitude != null && incident.location?.longitude != null ? (
        <Text className="mt-1 text-slate-400 text-sm">
          Lokasi: {incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}
        </Text>
      ) : null}
    </Pressable>
  );
}
