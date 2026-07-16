import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, Text, Pressable } from 'react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IncidentLocation, LocationHistoryEntry } from '@aegis/shared';

export function RouteMap({ location, history }: { location: IncidentLocation; history: LocationHistoryEntry[] }) {
  // If no location at all, show a placeholder
  if (!location && (!history || history.length === 0)) {
    return (
      <View className="rounded-3xl bg-slate-900 p-5">
        <Text className="text-slate-300">Lokasi awal tidak tersedia.</Text>
      </View>
    );
  }

  // Build route: prefer provided history, otherwise single-point from `location`
  const route = useMemo(() => {
    if (Array.isArray(history) && history.length > 0) {
      return history.map((h) => ({ latitude: h.latitude, longitude: h.longitude }));
    }
    if (location) return [{ latitude: location.latitude, longitude: location.longitude }];
    return [] as { latitude: number; longitude: number }[];
  }, [history, location]);

  const initial = route[0] ?? { latitude: location?.latitude ?? 0, longitude: location?.longitude ?? 0 };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && route.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((i) => {
          const next = i + 1;
          if (next >= route.length) {
            // stop at end
            setIsPlaying(false);
            return i;
          }
          return next;
        });
      }, intervalMs) as unknown as number;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as unknown as number);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, intervalMs, route.length]);

  // reset currentIndex when route changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [history]);

  const currentCoord = route[currentIndex] ?? initial;

  return (
    <View className="h-72 overflow-hidden rounded-3xl bg-slate-900">
      <MapView className="flex-1" initialRegion={{ ...initial, latitudeDelta: 0.01, longitudeDelta: 0.01 }} region={{ ...currentCoord, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
        {route.length > 0 ? <Polyline coordinates={route} strokeColor="#f472b6" strokeWidth={4} /> : null}
        <Marker coordinate={{ latitude: currentCoord.latitude, longitude: currentCoord.longitude }} title="Current" />
      </MapView>

      <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
        <View className="flex-row space-x-2">
          <Pressable onPress={() => { setIsPlaying((p) => !p); }} className="rounded-full bg-pink-500 p-2">
            <Text className="text-white">{isPlaying ? 'Pause' : 'Play'}</Text>
          </Pressable>
          <Pressable onPress={() => { setCurrentIndex(0); setIsPlaying(false); }} className="rounded-full bg-slate-700 p-2">
            <Text className="text-white">Reset</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center space-x-2">
          <Pressable onPress={() => setIntervalMs(1000)} className={`rounded-full p-2 ${intervalMs === 1000 ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <Text className="text-white">1x</Text>
          </Pressable>
          <Pressable onPress={() => setIntervalMs(500)} className={`rounded-full p-2 ${intervalMs === 500 ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <Text className="text-white">2x</Text>
          </Pressable>
          <Pressable onPress={() => setIntervalMs(250)} className={`rounded-full p-2 ${intervalMs === 250 ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <Text className="text-white">4x</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
