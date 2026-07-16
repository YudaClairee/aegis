import MapView, { Marker, Polyline } from 'react-native-maps';
import { View, Text, Linking } from 'react-native';
import React from 'react';
import { LocationUpdate } from '@aegis/shared';

export function LiveMap({ currentLocation, history }: { currentLocation: LocationUpdate | null; history: LocationUpdate[] }) {
  if (!currentLocation) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-slate-300">Menunggu lokasi korban...</Text>
      </View>
    );
  }

  const region = {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const route = history.map((item) => ({ latitude: item.latitude, longitude: item.longitude }));

  return (
    <View className="flex-1">
      <MapView className="flex-1 rounded-3xl" initialRegion={region} region={region}>
        <Marker coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }} title="Korban" />
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#f472b6" strokeWidth={4} /> : null}
      </MapView>
      <View className="bg-slate-950 p-4">
        <Text className="text-slate-200">Terakhir diperbarui: {new Date(currentLocation.timestamp).toLocaleTimeString()}</Text>
        <Text className="text-slate-400">Lat: {currentLocation.latitude.toFixed(5)}, Lon: {currentLocation.longitude.toFixed(5)}</Text>
        <Text className="text-slate-400">Akurasi: {currentLocation.accuracy ?? '-'} m</Text>
        <Text className="text-slate-400">Kecepatan: {currentLocation.speed ?? 0} m/s</Text>
      </View>
    </View>
  );
}
