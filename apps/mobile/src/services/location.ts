import * as Location from 'expo-location';

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: foreground.granted,
    background: background.granted,
  };
}

export async function getCurrentLocation() {
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? null,
    speed: coords.speed ?? null,
    heading: coords.heading ?? null,
    timestamp: Date.now(),
  };
}
