import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import type { AuthUser, Profile } from '@aegis/shared';

// Helper function to map Supabase profiles row to Aegis Profile type
function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone || null,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
  };
}

const authRouter = new Hono<{ Variables: AuthVariables }>();

// 1. POST /register (No Auth)
authRouter.post('/register', async (c) => {
  const { email, password, fullName, phone } = await c.req.json();

  if (!email || !password || !fullName) {
    throw new HTTPException(400, { message: 'Email, password, and fullName are required' });
  }

  // Register in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone || null,
      },
    },
  });

  if (error || !data.user) {
    throw new HTTPException(400, { message: error?.message || 'Registration failed' });
  }

  // Fetch the user profile created automatically by the database trigger
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileErr || !profileRow) {
    throw new HTTPException(500, { message: 'Failed to retrieve profile record after registration' });
  }

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email || '',
    profile: mapProfileRow(profileRow),
  };

  return c.json({
    user,
    session: {
      accessToken: data.session?.access_token || '',
      refreshToken: data.session?.refresh_token || '',
    },
  }, 201);
});

// 2. POST /login (No Auth)
authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    throw new HTTPException(400, { message: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) {
    throw new HTTPException(400, { message: error?.message || 'Invalid email or password' });
  }

  // Fetch the profile matching the logged-in user
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileErr || !profileRow) {
    throw new HTTPException(500, { message: 'Profile record not found' });
  }

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email || '',
    profile: mapProfileRow(profileRow),
  };

  return c.json({
    user,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  }, 200);
});

// 3. POST /logout (Auth)
authRouter.post('/logout', authMiddleware, async (c) => {
  const token = c.get('accessToken');

  const { error } = await supabase.auth.admin.signOut(token);

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, message: 'Logged out successfully' });
});

// 4. GET /me (Auth)
authRouter.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');

  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profileRow) {
    throw new HTTPException(404, { message: 'Profile not found' });
  }

  const user: AuthUser = {
    id: userId,
    email: userEmail,
    profile: mapProfileRow(profileRow),
  };

  return c.json({ user });
});

// 5. PUT /profile (Auth)
authRouter.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { fullName, phone } = await c.req.json();

  const updateData: any = {};
  if (fullName !== undefined) updateData.full_name = fullName;
  if (phone !== undefined) updateData.phone = phone;

  if (Object.keys(updateData).length === 0) {
    throw new HTTPException(400, { message: 'No fields to update' });
  }

  const { data: profileRow, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error || !profileRow) {
    throw new HTTPException(500, { message: error?.message || 'Failed to update profile' });
  }

  return c.json({ profile: mapProfileRow(profileRow) });
});

// 6. POST /refresh (No Auth)
authRouter.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json();

  if (!refreshToken) {
    throw new HTTPException(400, { message: 'Refresh token is required' });
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new HTTPException(400, { message: error?.message || 'Invalid or expired refresh token' });
  }

  return c.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  });
});

// 7. PUT /push-token (Auth)
authRouter.put('/push-token', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { token, platform } = await c.req.json();

  if (!token || !platform) {
    throw new HTTPException(400, { message: 'Token and platform are required' });
  }

  if (!['android', 'ios', 'web'].includes(platform)) {
    throw new HTTPException(400, { message: 'Invalid platform' });
  }

  const { error } = await supabase
    .from('device_tokens')
    .upsert({
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,token',
    });

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, message: 'Push token registered successfully' });
});

// 8. DELETE /push-token (Auth)
authRouter.delete('/push-token', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { token } = await c.req.json();

  if (!token) {
    throw new HTTPException(400, { message: 'Token is required' });
  }

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, message: 'Push token deleted successfully' });
});

export { authRouter };
