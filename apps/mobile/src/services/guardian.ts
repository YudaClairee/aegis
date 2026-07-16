import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { useGuardianStore } from '../stores/guardian-store';

export const GUARDIAN_TASK = 'guardian-location-task';

let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;

export function startAccelerometerMonitoring(onData: (data: { x: number; y: number; z: number }) => void) {
  Accelerometer.setUpdateInterval(100);
  accelerometerSubscription = Accelerometer.addListener(onData);
}

export function stopAccelerometerMonitoring() {
  if (accelerometerSubscription) {
    accelerometerSubscription.remove();
    accelerometerSubscription = null;
  }
}

export async function requestGuardianPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();
  const audio = await Audio.requestPermissionsAsync();

  return {
    foreground: foreground.granted,
    background: background.granted,
    audio: audio.granted,
  };
}

export async function startGuardianSession() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(GUARDIAN_TASK);
  if (hasStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(GUARDIAN_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: '🛡️ Guardian Active',
      notificationBody: 'Aegis keeps your location active while Guardian mode is enabled.',
      notificationColor: '#E91E63',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopGuardianSession() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(GUARDIAN_TASK);
  if (!hasStarted) {
    return;
  }
  await Location.stopLocationUpdatesAsync(GUARDIAN_TASK);
}

if (!TaskManager.isTaskDefined || !TaskManager.isTaskDefined(GUARDIAN_TASK)) {
  TaskManager.defineTask(GUARDIAN_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Guardian location task error', error.message);
      return;
    }

    const body = data as { locations?: Array<{ coords: any; timestamp: number }> } | null;
    const locations = body?.locations;
    if (!locations || locations.length === 0) {
      return;
    }

    const location = locations[0];
    useGuardianStore.getState().setLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? null,
      speed: location.coords.speed ?? null,
      timestamp: location.timestamp,
    });
  });
}
