import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { supabase } from '../services/supabase';

// Mock the whole @supabase/supabase-js module
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    getUser: vi.fn(),
  };

  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  }));

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  };
});

describe('Contacts Routes', () => {
  const mockUserId = 'user-id-123';
  const mockToken = 'valid-token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'test@example.com' } as any,
      },
      error: null,
    });
  });

  describe('GET /api/contacts', () => {
    it('should return contacts listing for authenticated user', async () => {
      const mockContactsList = [
        { id: 'c1', user_id: mockUserId, name: 'Alice', phone: '+62812345' },
        { id: 'c2', user_id: mockUserId, name: 'Bob', phone: '+62854321' },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: mockContactsList, error: null }),
      } as any);

      const res = await app.request('/api/contacts', {
        method: 'GET',
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.contacts).toHaveLength(2);
      expect(json.contacts[0].name).toBe('Alice');
      expect(json.contacts[1].name).toBe('Bob');
    });
  });

  describe('POST /api/contacts', () => {
    it('should add a new contact successfully', async () => {
      const newContact = {
        name: 'Mama',
        phone: '+6281234567890',
        relationship: 'parent',
        isPrimary: true,
      };

      const mockInsertedRow = {
        id: 'c-new',
        user_id: mockUserId,
        name: 'Mama',
        phone: '+6281234567890',
        relationship: 'parent',
        is_primary: true,
      };

      // Mock update to reset previous primary contacts, and then insert
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'emergency_contacts') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockInsertedRow, error: null }),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      const res = await app.request('/api/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContact),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.contact.id).toBe('c-new');
      expect(json.contact.isPrimary).toBe(true);
    });

    it('should return 400 for invalid contact body format', async () => {
      const res = await app.request('/api/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: '123', // name missing
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error.message).toContain('Validation failed');
    });
  });
});
