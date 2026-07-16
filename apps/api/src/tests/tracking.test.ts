import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { supabase } from '../services/supabase';
import { assertIsIncidentOwner, assertCanAccessIncident } from '../services/contact-access';

// Mock @supabase/supabase-js directly
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    getUser: vi.fn(),
  };

  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  }));

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  };
});

// Mock Access Checks
vi.mock('../services/contact-access', () => {
  return {
    assertIsIncidentOwner: vi.fn(),
    assertCanAccessIncident: vi.fn(),
  };
});

describe('Tracking Routes', () => {
  const mockUserId = 'user-id-123';
  const mockToken = 'valid-token';
  const mockIncidentId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'test@example.com' } as any,
      },
      error: null,
    });
  });

  describe('POST /api/tracking/location', () => {
    it('should persist a single location successfully for active incident owner', async () => {
      const mockIncident = { id: mockIncidentId, user_id: mockUserId, status: 'triggered' };
      vi.mocked(assertIsIncidentOwner).mockResolvedValueOnce(mockIncident);

      const mockLocationRow = {
        id: 'loc-1',
        incident_id: mockIncidentId,
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 10,
        speed: 1.5,
        heading: 90,
        recorded_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValueOnce({ data: mockLocationRow, error: null }),
          })),
        })),
      } as any);

      const res = await app.request('/api/tracking/location', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incidentId: mockIncidentId,
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 10,
          speed: 1.5,
          heading: 90,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.location.id).toBe('loc-1');
    });

    it('should reject location updates for a resolved incident', async () => {
      const mockIncident = { id: mockIncidentId, user_id: mockUserId, status: 'resolved' };
      vi.mocked(assertIsIncidentOwner).mockResolvedValueOnce(mockIncident);

      const res = await app.request('/api/tracking/location', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incidentId: mockIncidentId,
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 10,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error.message).toContain('inactive or resolved');
    });
  });

  describe('GET /api/tracking/:incidentId/access', () => {
    it('should return authorization and role for user with access', async () => {
      // Simulate owner access check (assertCanAccessIncident resolves)
      vi.mocked(assertCanAccessIncident).mockResolvedValueOnce({ user_id: mockUserId } as any);

      const res = await app.request(`/api/tracking/${mockIncidentId}/access`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.authorized).toBe(true);
      expect(json.role).toBe('owner');
    });
  });
});
