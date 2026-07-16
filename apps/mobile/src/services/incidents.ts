import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export async function resolveIncident(id: string, payload: { resolution: 'resolved' | 'false_alarm'; notes?: string }) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/sos/${id}/resolve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to resolve incident ${id}`);
  }

  return response.json();
}

export async function rerunAiAnalysis(id: string) {
  console.warn('Rerun AI analysis is not supported by the backend yet.');
  return { success: false, message: 'Not supported' };
}

export async function fetchComments(id: string) {
  // Gracefully return empty comments since backend doesn't support comments yet
  return { comments: [] as Comment[] };
}

export async function postComment(id: string, text: string) {
  throw new Error('Comments are not supported by the backend yet.');
}

