import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import { env } from '../lib/env';
import { HTTPException } from 'hono/http-exception';

export type AuthVariables = {
  userId: string;
  userEmail: string;
  accessToken: string;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Initialize a new supabase client using the user's token so that standard RLS policies check correctly
  const userSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: { user }, error } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }

  c.set('userId', user.id);
  c.set('userEmail', user.email || '');
  c.set('accessToken', token);

  await next();
});
