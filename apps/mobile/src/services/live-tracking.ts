import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/env';
import { LocationUpdate } from '@aegis/shared';

let channel: ReturnType<typeof supabase.channel> | null = null;
let currentIncidentId: string | null = null;

export function startLiveBroadcast(incidentId: string, userId: string) {
  if (channel && currentIncidentId === incidentId) {
    return channel;
  }

  if (channel) {
    stopLiveBroadcast();
  }

  currentIncidentId = incidentId;
  channel = supabase.channel(`tracking:${incidentId}`);

  channel.on('broadcast', { event: 'location-update' }, (payload) => {
    // sender does not need local handling here;
    // receiver will subscribe separately.
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Live tracking channel subscribed', incidentId);
    }
  });

  return channel;
}

export async function broadcastLocation(incidentId: string, userId: string, coords: Omit<LocationUpdate, 'userId' | 'incidentId'>) {
  if (!channel || currentIncidentId !== incidentId) {
    channel = startLiveBroadcast(incidentId, userId);
  }

  const update: LocationUpdate = {
    userId,
    incidentId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    timestamp: new Date().toISOString(),
  };

  channel?.send({ type: 'broadcast', event: 'location-update', payload: update });

  return update;
}

export function stopLiveBroadcast() {
  if (!channel) {
    return;
  }
  channel.unsubscribe();
  channel = null;
  currentIncidentId = null;
}

export async function persistLocationHistory(incidentId: string, location: Omit<LocationUpdate, 'userId' | 'incidentId'>) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/tracking/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      incidentId,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      heading: location.heading,
      accuracy: location.accuracy,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist tracking location: ${response.status}`);
  }

  return response.json();
}
