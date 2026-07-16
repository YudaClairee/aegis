import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
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

    setStatus('connecting');
    const channel = supabase.channel(`tracking:${incidentId}`);

    channel.on('broadcast', { event: 'location-update' }, (payload) => {
      const update = payload.payload as LocationUpdate;
      setCurrentLocation(update);
      setLocationHistory((previous) => [...previous, update]);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected');
      }
      if (status === 'CHANNEL_ERROR') {
        setError('Gagal terkoneksi ke live tracking.');
        setStatus('error');
      }
    });

    return () => {
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
