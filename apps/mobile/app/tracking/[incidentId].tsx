import { View, Text, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useLiveTracking } from '../../src/hooks/useLiveTracking';
import { LiveMap } from '../../src/components/maps/LiveMap';

export default function TrackingPage() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const { currentLocation, locationHistory, status, error } = useLiveTracking(incidentId);

  return (
    <View className="flex-1 bg-slate-950">
      <Stack.Screen options={{ title: 'Live Tracking' }} />
      <View className="p-5">
        <Text className="text-xl font-bold text-white">Live Tracking</Text>
        <Text className="mt-2 text-slate-300">Tracking incident ID: {incidentId}</Text>
      </View>

      {error ? (
        <View className="mx-5 rounded-3xl bg-rose-950 p-4">
          <Text className="text-red-300">{error}</Text>
        </View>
      ) : null}

      <View className="flex-1">
        <LiveMap currentLocation={currentLocation} history={locationHistory} />
      </View>

      {status !== 'connected' ? (
        <View className="p-5">
          <Text className="text-slate-400">Status: {status}</Text>
        </View>
      ) : null}
    </View>
  );
}
