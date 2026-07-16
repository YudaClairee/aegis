import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import { normalizeIncident } from '../lib/normalize';
import type { Incident as SharedIncident } from '@aegis/shared';

export type Incident = SharedIncident;

async function fetchIncidents() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch incidents: ${response.status}`);
  }

  const json = await response.json();
  const own = Array.isArray(json.ownIncidents) ? json.ownIncidents : [];
  const family = Array.isArray(json.familyIncidents) ? json.familyIncidents : [];

  const combined = [...own, ...family].map(normalizeIncident);
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return combined;
}

export function useIncidents() {
  return useQuery<Incident[], Error>({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
  });
}
