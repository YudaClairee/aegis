import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export async function updateIncident(id: string, payload: Record<string, any>) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to update incident ${id}`);
  }

  return response.json();
}

export async function rerunAiAnalysis(id: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents/${id}/reprocess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to re-run AI for ${id}`);
  }

  return response.json();
}

export async function fetchComments(id: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents/${id}/comments`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to fetch comments for ${id}`);
  }

  return response.json() as Promise<{ comments: Comment[] }>;
}

export async function postComment(id: string, text: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/incidents/${id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to post comment for ${id}`);
  }

  return response.json() as Promise<{ comment: Comment }>;
}
