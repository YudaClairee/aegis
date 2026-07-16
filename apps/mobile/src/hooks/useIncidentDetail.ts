import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import type { Incident } from '@aegis/shared';

async function fetchIncident(id: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch incident: ${response.status}`);
  }

  return response.json() as Promise<Incident>;
}

export function useIncidentDetail(id: string) {
  return useQuery<Incident, Error>({
    queryKey: ['incident', id],
    queryFn: () => fetchIncident(id),
    enabled: Boolean(id),
  });
}
