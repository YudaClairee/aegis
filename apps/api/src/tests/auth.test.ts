import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';
import { supabase } from '../services/supabase';

// Mock the whole @supabase/supabase-js module
vi.mock('@supabase/supabase-js', () => {
  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getUser: vi.fn(),
  };

  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = { id: 'user-id-123', email: 'test@example.com' };
      const mockProfile = { id: 'user-id-123', full_name: 'John Doe', phone: '+628123456789' };

      // Stub auth.signUp
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { user: mockUser, session: null } as any,
        error: null,
      });

      // Stub profiles table query: select().eq().single()
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null }),
      } as any);

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'John Doe',
          phone: '+628123456789',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      expect(json.user).toBeDefined();
      expect(json.user.id).toBe('user-id-123');
      expect(json.user.profile.fullName).toBe('John Doe');
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error.message).toContain('required');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = { id: 'user-id-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token-123', refresh_token: 'refresh-123' };
      const mockProfile = { id: 'user-id-123', full_name: 'John Doe' };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession } as any,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null }),
      } as any);

      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.session.accessToken).toBe('token-123');
      expect(json.user.profile.fullName).toBe('John Doe');
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without authorization token', async () => {
      const res = await app.request('/api/auth/me', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' } as any,
      });

      const res = await app.request('/api/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(res.status).toBe(401);
    });
  });
});
