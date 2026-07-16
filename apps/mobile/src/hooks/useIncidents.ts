import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
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

  return response.json() as Promise<Incident[]>;
}

export function useIncidents() {
  return useQuery<Incident[], Error>({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
  });
}
