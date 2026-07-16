export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!API_URL) {
  console.warn('Missing EXPO_PUBLIC_API_URL');
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase public env vars');
}
