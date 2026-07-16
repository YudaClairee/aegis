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

// Mock FCM
vi.mock('../services/fcm', () => {
  return {
    sendSOSNotification: vi.fn().mockResolvedValue(true),
    sendNoResponseNotification: vi.fn().mockResolvedValue(true),
    sendResolutionNotification: vi.fn().mockResolvedValue(true),
    sendAISummaryNotification: vi.fn().mockResolvedValue(true),
    fetchFamilyTokens: vi.fn().mockResolvedValue([]),
  };
});

// Mock Idempotency Service
vi.mock('../services/idempotency', () => {
  return {
    checkIdempotency: vi.fn().mockResolvedValue(null),
    saveIdempotency: vi.fn().mockResolvedValue(true),
  };
});

describe('SOS Routes', () => {
  const mockUserId = 'user-id-123';
  const mockToken = 'valid-token';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'test@example.com' } as any,
      },
      error: null,
    });
  });

  describe('POST /api/sos/trigger', () => {
    it('should trigger SOS successfully for manual button', async () => {
      const mockIncidentRow = {
        id: 'inc-123',
        user_id: mockUserId,
        status: 'triggered',
        trigger_type: 'manual',
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 10,
        risk_score: null,
        keywords_detected: null,
        trigger_context: {},
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValueOnce({ data: mockIncidentRow, error: null }),
          })),
        })),
      } as any);

      const res = await app.request('/api/sos/trigger', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggerType: 'manual',
          location: {
            latitude: -6.2088,
            longitude: 106.8456,
            accuracy: 10,
          },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.incident.id).toBe('inc-123');
      expect(json.incident.triggerType).toBe('manual');
    });

    it('should trigger SOS successfully for no_response without keywords/audio details', async () => {
      const mockIncidentRow = {
        id: 'inc-123',
        user_id: mockUserId,
        status: 'triggered',
        trigger_type: 'no_response',
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 10,
        risk_score: null,
        keywords_detected: null,
        trigger_context: { escalationReason: 'missed checkin' },
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValueOnce({ data: mockIncidentRow, error: null }),
          })),
        })),
      } as any);

      const res = await app.request('/api/sos/trigger', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          triggerType: 'no_response',
          location: {
            latitude: -6.2088,
            longitude: 106.8456,
            accuracy: 10,
          },
          triggerContext: {
            escalationReason: 'missed checkin',
          },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.incident.id).toBe('inc-123');
      expect(json.incident.triggerType).toBe('no_response');
    });
  });
});
