import { createClient } from '@supabase/supabase-js';
import { env } from '../lib/env';

// Administrative Supabase client using the service role key.
// This client bypasses Row Level Security (RLS) and is intended for backend administrative tasks.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
