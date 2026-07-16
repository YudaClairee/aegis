import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';

export type SOSTriggerData = {
  triggerType: 'manual' | 'risk_engine' | 'keyword' | 'notification_button';
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
}
