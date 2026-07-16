import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { supabase } from '../services/supabase';

// Mock @supabase/supabase-js directly
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    getUser: vi.fn(),
  };

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
    })),
  };
});

// Mock OpenRouter Service
vi.mock('../services/openrouter', () => {
  return {
    analyzeIncidentAudio: vi.fn().mockResolvedValue({
      transcript: 'Tolong ada maling!',
      aiSummary: {
        risk: 95,
        classification: 'robbery',
        recommendation: 'send_sos',
        summary: 'Korban berteriak ada maling.',
        keywords_detected: ['maling'],
        confidence: 0.98,
      },
    }),
  };
});

describe('AI Routes', () => {
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

  describe('POST /api/ai/analyze', () => {
    it('should reject requests without a file', async () => {
      const res = await app.request('/api/ai/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error.message).toContain('required');
    });

    it('should reject unsupported audio format', async () => {
      const formData = new FormData();
      const mockFile = new Blob(['dummy audio content'], { type: 'image/png' });
      formData.append('audio', mockFile, 'test.png');

      const res = await app.request('/api/ai/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` },
        body: formData,
      });

      expect(res.status).toBe(415);
      const json = await res.json() as any;
      expect(json.error.message).toContain('Unsupported audio type');
    });

    it('should process supported audio and call AI pipeline successfully', async () => {
      const formData = new FormData();
      const mockFile = new Blob(['dummy audio content'], { type: 'audio/wav' });
      formData.append('audio', mockFile, 'test.wav');

      const res = await app.request('/api/ai/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` },
        body: formData,
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.transcript).toBe('Tolong ada maling!');
      expect(json.aiSummary.classification).toBe('robbery');
    });
  });
});
