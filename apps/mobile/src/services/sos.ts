import { TriggerType } from '@aegis/shared';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import { queueRequest } from './offline-queue';

export type SOSTriggerData = {
  triggerType: TriggerType;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
  };
  riskScore?: number;
  keywordsDetected?: string[];
};

export async function triggerSOS(data: SOSTriggerData) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  try {
    const response = await fetch(`${API_URL}/api/sos/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(payload || `SOS request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.warn('triggerSOS failed, queueing offline:', error);
    // Queue the SOS trigger request for background retry when connection is restored
    await queueRequest('sos_trigger', '/api/sos/trigger', 'POST', data);
    // Throw user-friendly message indicating offline status
    throw new Error('Koneksi terputus. SOS Anda telah disimpan secara offline dan akan dikirim secara otomatis saat terhubung kembali.');
  }
}

