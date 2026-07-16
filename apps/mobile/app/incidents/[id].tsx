import { View, Text, ScrollView, Pressable, Linking, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { useIncidentDetail } from '../../src/hooks/useIncidentDetail';
import { resolveIncident } from '../../src/services/incidents';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { AISummaryCard } from '../../src/components/incidents/AISummaryCard';
import { RouteMap } from '../../src/components/maps/RouteMap';
import { LocationHistoryEntry } from '@aegis/shared';
import { useEffect, useMemo, useState } from 'react';

export default function IncidentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error } = useIncidentDetail(id ?? '');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const locationHistory = useMemo<LocationHistoryEntry[]>(() => {
    // Support optional `locationHistory` returned by the API; otherwise use a single-point fallback
    const apiHistory = (data as any)?.locationHistory;
    if (Array.isArray(apiHistory) && apiHistory.length > 0) {
      return apiHistory as LocationHistoryEntry[];
    }

    if (data?.location?.latitude != null && data?.location?.longitude != null) {
      return [
        {
          id: 'start',
          incidentId: data.id,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          speed: data.location.speed ?? null,
          recordedAt: data.createdAt,
        },
      ];
    }

    return [];
  }, [data]);

  const queryClient = useQueryClient();

  const resolveIncidentMutation = useMutation<any, Error, { resolution: 'resolved' | 'false_alarm'; notes?: string }>({
    mutationFn: (payload) => resolveIncident(id ?? '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

  async function playAudio() {
    if (!data?.audioUrl) return;
    try {
      if (!sound) {
        const { sound: created } = await Audio.Sound.createAsync({ uri: data.audioUrl });
        setSound(created);
        await created.playAsync();
        setIsPlaying(true);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('Audio playback failed', err);
    }
  }

  async function handleResolve(note?: string) {
    try {
      await resolveIncidentMutation.mutateAsync({ resolution: 'resolved', notes: note });
    } catch (err) {
      console.warn('Resolve failed', err);
    }
  }

  async function pauseAudio() {
    try {
      if (sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('Pause failed', err);
    }
  }

  async function stopAudio() {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('Stop failed', err);
    }
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  function openMaps() {
    if (!data?.location) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${data.location.latitude},${data.location.longitude}`;
    Linking.openURL(url);
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 p-5 justify-center items-center">
        <Text className="text-slate-300">Memuat detail incident...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 bg-slate-950 p-5 justify-center items-center">
        <Text className="text-red-400">{error?.message ?? 'Gagal memuat incident.'}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <Stack.Screen options={{ title: 'Incident Detail' }} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="rounded-3xl bg-slate-900 p-5 mb-4">
          <Text className="text-2xl font-bold text-white">Incident</Text>
          <Text className="mt-2 text-slate-300">Status: {data.status}</Text>
          <Text className="text-slate-300">Trigger: {data.triggerType}</Text>
          <Text className="text-slate-300">Risk Score: {data.riskScore ?? 'N/A'}</Text>
          <Text className="text-slate-300">Classification: {data.classification ?? 'N/A'}</Text>
          <Text className="text-slate-300">Created at: {new Date(data.createdAt).toLocaleString()}</Text>
          {data.resolvedAt ? <Text className="text-slate-300">Resolved at: {new Date(data.resolvedAt).toLocaleString()}</Text> : null}
        </View>

        {data.status === 'triggered' ? (
          <View className="rounded-3xl bg-pink-950/80 p-5 border border-pink-700/50 mb-4 flex-row items-center space-x-3">
            <ActivityIndicator color="#f472b6" />
            <Text className="text-pink-300 font-medium text-sm flex-1">🎙️ Sedang merekam suara sekitar selama 15 detik...</Text>
          </View>
        ) : null}

        {data.aiSummary ? <AISummaryCard summary={data.aiSummary} /> : (
          <View className="rounded-3xl bg-slate-900 p-5 mb-4">
            <Text className="text-white text-lg font-semibold">AI analysis pending</Text>
            <Text className="mt-2 text-slate-300">Hasil AI akan muncul setelah audio diproses.</Text>
          </View>
        )}

        <View className="rounded-3xl bg-slate-900 p-5 mb-4">
          <Text className="text-lg font-semibold text-white">Transcript</Text>
          <Text className="mt-3 text-slate-300">{data.transcript ?? 'Belum tersedia'}</Text>
        </View>

        <View className="space-y-4 mb-4">
          <View className="flex-row space-x-3">
            <Pressable onPress={playAudio} className="flex-1 rounded-3xl bg-pink-500 p-4 items-center">
              <Text className="text-white font-semibold">{data.audioUrl ? (isPlaying ? 'Playing' : 'Play') : 'Audio tidak tersedia'}</Text>
            </Pressable>
            <Pressable onPress={pauseAudio} className="flex-1 rounded-3xl bg-amber-500 p-4 items-center">
              <Text className="text-slate-950 font-semibold">Pause</Text>
            </Pressable>
            <Pressable onPress={stopAudio} className="flex-1 rounded-3xl bg-slate-800 p-4 items-center">
              <Text className="text-white font-semibold">Stop</Text>
            </Pressable>
          </View>
          <Pressable onPress={openMaps} className="rounded-3xl bg-slate-800 p-4 items-center">
            <Text className="text-white font-semibold">Buka di Maps</Text>
          </Pressable>
        </View>

        <View className="rounded-3xl bg-slate-900 p-5 mb-4">
          <Text className="text-lg font-semibold text-white">Actions</Text>
          <View className="mt-3 space-y-3">
            {data.status !== 'resolved' && data.status !== 'false_alarm' ? (
              <Pressable onPress={() => setShowResolveModal(true)} disabled={resolveIncidentMutation.status === 'pending'} className="rounded-3xl bg-emerald-600 p-3 items-center">
                {resolveIncidentMutation.status === 'pending' ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Mark as Resolved</Text>}
              </Pressable>
            ) : (
              <Text className="text-slate-400 text-sm text-center">Incident has been resolved.</Text>
            )}
          </View>
        </View>

        <View className="rounded-3xl bg-slate-900 p-5 mb-4">
          <Text className="text-lg font-semibold text-white">Comments</Text>
          <Text className="mt-2 text-slate-400 text-sm">Comments are not supported by the backend yet.</Text>
        </View>

        <Modal visible={showResolveModal} transparent animationType="slide">
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="w-11/12 bg-slate-900 p-5 rounded-2xl">
              <Text className="text-white text-lg font-semibold">Resolve Incident</Text>
              <Text className="mt-2 text-slate-300">Optional resolution note:</Text>
              <TextInput
                value={resolutionNoteInput}
                onChangeText={setResolutionNoteInput}
                placeholder="Add resolution details"
                placeholderTextColor="#94a3b8"
                className="bg-slate-800 rounded-2xl p-3 text-white mt-3"
              />
              <View className="mt-4 flex-row space-x-3">
                <Pressable onPress={() => setShowResolveModal(false)} className="flex-1 rounded-2xl bg-slate-700 p-3 items-center">
                  <Text className="text-white">Cancel</Text>
                </Pressable>
                <Pressable onPress={async () => { await handleResolve(resolutionNoteInput); setShowResolveModal(false); setResolutionNoteInput(''); }} className="flex-1 rounded-2xl bg-emerald-600 p-3 items-center">
                  {resolveIncidentMutation.status === 'pending' ? <ActivityIndicator color="#fff" /> : <Text className="text-white">Confirm Resolve</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <RouteMap location={data.location} history={locationHistory} />

        {data.aiSummary?.summary ? (
          <View className="rounded-3xl bg-slate-900 p-5 mt-4">
            <Text className="text-lg font-semibold text-white">Resolution Notes</Text>
            <Text className="mt-3 text-slate-300">{data.aiSummary.summary}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
