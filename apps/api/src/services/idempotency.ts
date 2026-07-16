import { supabase } from './supabase';

/**
 * Checks if a cached response exists for the given user and idempotency key.
 */
export async function checkIdempotency(userId: string, key: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('response')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;
  return data.response;
}

/**
 * Saves a response payload against the user and idempotency key.
 */
export async function saveIdempotency(userId: string, key: string, response: any): Promise<void> {
  const { error } = await supabase
    .from('idempotency_keys')
    .upsert({
      user_id: userId,
      key,
      response,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,key',
    });

  if (error) {
    console.error(`⚠️ Failed to save idempotency key "${key}" for user "${userId}":`, error.message);
  }
}
