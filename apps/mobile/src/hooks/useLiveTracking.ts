import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/env';
import { LocationUpdate } from '@aegis/shared';

export function useLiveTracking(incidentId: string) {
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationUpdate[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) {
      return;
    }

    let isMounted = true;
    setStatus('connecting');

    async function loadInitialHistory() {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const response = await fetch(`${API_URL}/api/incidents/${incidentId}/locations`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.status}`);
        }

        const json = await response.json();
        const locations = Array.isArray(json.locations) ? json.locations : [];
        const mapped = locations.map((loc: any): LocationUpdate => ({
          userId: '',
          incidentId: loc.incidentId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed ?? null,
          heading: loc.heading ?? null,
          accuracy: loc.accuracy ?? 0,
          timestamp: loc.recordedAt || new Date().toISOString(),
        }));

        if (isMounted) {
          setLocationHistory(mapped);
          if (mapped.length > 0) {
            setCurrentLocation(mapped[mapped.length - 1]);
          }
        }
      } catch (err) {
        console.warn('Failed to load initial tracking locations', err);
      }
    }

    loadInitialHistory();

    const channel = supabase.channel(`tracking:${incidentId}`);

    channel.on('broadcast', { event: 'location-update' }, (payload) => {
      const update = payload.payload as LocationUpdate;
      if (isMounted) {
        setCurrentLocation(update);
        setLocationHistory((previous) => [...previous, update]);
      }
    });

    channel.subscribe((status) => {
      if (!isMounted) return;
      if (status === 'SUBSCRIBED') {
        setStatus('connected');
      }
      if (status === 'CHANNEL_ERROR') {
        setError('Gagal terkoneksi ke live tracking.');
        setStatus('error');
      }
    });

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [incidentId]);

  const latestPoint = useMemo(() => currentLocation ?? locationHistory[locationHistory.length - 1] ?? null, [currentLocation, locationHistory]);

  return {
    currentLocation: latestPoint,
    locationHistory,
    status,
    error,
  };
}
