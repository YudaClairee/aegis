import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import type { EmergencyContact } from '@aegis/shared';

export interface LinkedRelation {
  id: string;
  name: string;
  relationship: string | null;
  inviteStatus: 'pending' | 'accepted' | 'revoked';
  acceptedAt: string | null;
  victim: {
    id: string;
    fullName: string;
    phone: string | null;
  } | null;
}

async function fetchMyLinks() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${API_URL}/api/contact-links/me`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch family links: ${response.status}`);
  }

  const json = await response.json();
  return (json.links || []) as LinkedRelation[];
}

export function useContactLinks() {
  const queryClient = useQueryClient();

  const linksQuery = useQuery<LinkedRelation[], Error>({
    queryKey: ['family-links'],
    queryFn: fetchMyLinks,
  });

  const generateInviteMutation = useMutation<{ inviteCode: string; contact: EmergencyContact }, Error, string>({
    mutationFn: async (contactId) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contact-links/${contactId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to generate invite code');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const acceptInviteMutation = useMutation<
    { contact: EmergencyContact; linkedTo: { userId: string; fullName: string } },
    Error,
    string
  >({
    mutationFn: async (inviteCode) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contact-links/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ inviteCode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Gagal memverifikasi kode undangan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-links'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const revokeLinkMutation = useMutation<void, Error, string>({
    mutationFn: async (contactId) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_URL}/api/contact-links/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to revoke contact link');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-links'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  return {
    links: linksQuery.data ?? [],
    isLoadingLinks: linksQuery.isLoading,
    isLinksError: linksQuery.isError,
    linksError: linksQuery.error,
    refetchLinks: linksQuery.refetch,
    generateInviteCode: generateInviteMutation.mutateAsync,
    isGeneratingInvite: generateInviteMutation.status === 'pending',
    acceptInviteCode: acceptInviteMutation.mutateAsync,
    isAcceptingInvite: acceptInviteMutation.status === 'pending',
    revokeLink: revokeLinkMutation.mutateAsync,
    isRevokingLink: revokeLinkMutation.status === 'pending',
  };
}
