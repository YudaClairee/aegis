import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import type { EmergencyContact } from '@aegis/shared';

async function fetchContacts() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/contacts`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contacts: ${response.status}`);
  }

  const json = await response.json();
  return (json.contacts || []) as EmergencyContact[];
}

export function useContacts() {
  const queryClient = useQueryClient();

  const query = useQuery<EmergencyContact[], Error>({
    queryKey: ['contacts'],
    queryFn: fetchContacts,
  });

  const createContactMutation = useMutation<
    EmergencyContact,
    Error,
    { name: string; phone: string; relationship?: string; isPrimary?: boolean }
  >({
    mutationFn: async (payload) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to create contact');
      }

      const json = await response.json();
      return json.contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const updateContactMutation = useMutation<
    EmergencyContact,
    Error,
    { id: string; name?: string; phone?: string; relationship?: string; isPrimary?: boolean }
  >({
    mutationFn: async ({ id, ...payload }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contacts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update contact');
      }

      const json = await response.json();
      return json.contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const deleteContactMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contacts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete contact');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const setPrimaryContactMutation = useMutation<EmergencyContact, Error, string>({
    mutationFn: async (id) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contacts/${id}/primary`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to set primary contact');
      }

      const json = await response.json();
      return json.contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createContact: createContactMutation.mutateAsync,
    isCreating: createContactMutation.status === 'pending',
    updateContact: updateContactMutation.mutateAsync,
    isUpdating: updateContactMutation.status === 'pending',
    deleteContact: deleteContactMutation.mutateAsync,
    isDeleting: deleteContactMutation.status === 'pending',
    setPrimaryContact: setPrimaryContactMutation.mutateAsync,
    isSettingPrimary: setPrimaryContactMutation.status === 'pending',
  };
}
