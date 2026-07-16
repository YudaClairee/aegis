import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { supabase } from '../services/supabase';

// Mock @supabase/supabase-js directly
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    getUser: vi.fn(),
  };

  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  }));

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  };
});

describe('Contact Links Routes', () => {
  const mockUserId = 'user-id-123';
  const mockToken = 'valid-token';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'victim@test.com' } as any,
      },
      error: null,
    });
  });

  describe('POST /api/contact-links/:contactId/invite', () => {
    it('should generate an invite code for a contact successfully', async () => {
      const mockContactId = 'c-111';
      const mockContactRow = { id: mockContactId, user_id: mockUserId, name: 'Alice' };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'emergency_contacts') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
              .mockResolvedValueOnce({ data: mockContactRow, error: null }) // for assertOwnContact
              .mockResolvedValueOnce({ 
                data: { ...mockContactRow, invite_code: 'INV-1234', invite_status: 'pending' }, 
                error: null 
              }), // for update select single
            maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }), // for uniqueness check
          };

          return {
            select: vi.fn().mockReturnValue(chain),
            update: vi.fn().mockReturnValue(chain),
          } as any;
        }
        return {} as any;
      });

      const res = await app.request(`/api/contact-links/${mockContactId}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.inviteCode).toBeDefined();
      expect(json.inviteCode).toHaveLength(8);
      expect(json.contact.id).toBe(mockContactId);
    });
  });

  describe('POST /api/contact-links/accept', () => {
    it('should accept an invite code as a family member successfully', async () => {
      const mockFamilyUserId = 'family-user-789';
      const mockInviteCode = 'INV-1234';

      // Update auth to simulate the family user performing the accept
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: {
          user: { id: mockFamilyUserId, email: 'family@test.com' } as any,
        },
        error: null,
      });

      // Mock search by invite code
      const mockContactRow = { id: 'c-111', user_id: 'victim-id-456', name: 'Alice', invite_status: 'pending' };
      // Mock accept update
      const mockAcceptedRow = { 
        id: 'c-111', 
        user_id: 'victim-id-456', 
        linked_user_id: mockFamilyUserId, 
        invite_status: 'accepted',
        accepted_at: new Date().toISOString()
      };
      // Mock profiles query to get victim's name
      const mockProfileRow = { id: 'victim-id-456', full_name: 'Victim User' };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'emergency_contacts') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockAcceptedRow, error: null }),
            maybeSingle: vi.fn().mockResolvedValueOnce({ data: mockContactRow, error: null }),
          };

          return {
            select: vi.fn().mockReturnValue(chain),
            update: vi.fn().mockReturnValue(chain),
          } as any;
        }
        if (table === 'profiles') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockProfileRow, error: null }),
          };

          return {
            select: vi.fn().mockReturnValue(chain),
          } as any;
        }
        return {} as any;
      });

      const res = await app.request('/api/contact-links/accept', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: mockInviteCode }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.contact.id).toBe('c-111');
      expect(json.linkedTo.userId).toBe('victim-id-456');
      expect(json.linkedTo.fullName).toBe('Victim User');
    });
  });
});
