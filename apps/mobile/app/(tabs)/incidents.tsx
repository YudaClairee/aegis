import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useIncidents } from '../../src/hooks/useIncidents';
import { IncidentCard } from '../../src/components/incidents/IncidentCard';

export default function IncidentsPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isFetching } = useIncidents();

  return (
    <View className="flex-1 bg-slate-950">
      <View className="p-5">
        <Text className="text-3xl font-bold text-white">Incident History</Text>
        <Text className="mt-2 text-slate-300">Lihat semua riwayat insiden yang telah direkam.</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        {isLoading ? (
          <Text className="text-slate-300">Memuat riwayat...</Text>
        ) : isError ? (
          <Text className="text-red-400">{error?.message ?? 'Gagal memuat riwayat insiden.'}</Text>
        ) : data && data.length > 0 ? (
          data.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onPress={() => router.push(`/incidents/${incident.id}`)}
            />
          ))
        ) : (
          <View className="rounded-3xl bg-slate-900 p-6">
            <Text className="text-slate-200">Belum ada insiden.</Text>
            <Text className="mt-2 text-slate-400">Aktifkan Guardian dan SOS untuk mulai merekam riwayat.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
