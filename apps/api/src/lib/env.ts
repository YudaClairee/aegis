import { z } from 'zod';
import { join } from 'path';

// Load environment variables natively using Node.js loadEnvFile
try {
  process.loadEnvFile();
} catch (e) {
  try {
    process.loadEnvFile(join(process.cwd(), 'apps/api/.env'));
  } catch (err) {
    try {
      process.loadEnvFile(join(__dirname, '../../.env'));
    } catch (error) {
      // In production or Docker, variables are injected directly in the system environment
    }
  }
}

const stripQuotes = (val: unknown): unknown => {
  if (typeof val === 'string') {
    return val.replace(/^["']|["']$/g, '');
  }
  return val;
};

// Custom schema types that strip quotes first
const cleanString = z.preprocess(stripQuotes, z.string());
const cleanNumber = z.preprocess(stripQuotes, z.coerce.number());

const envSchema = z.object({
  PORT: cleanNumber.default(3000),
  NODE_ENV: z.preprocess(stripQuotes, z.enum(['development', 'production', 'test'])).default('development'),
  SUPABASE_URL: cleanString.pipe(z.string().url()),
  SUPABASE_ANON_KEY: cleanString.pipe(z.string().min(1)),
  SUPABASE_SERVICE_ROLE_KEY: cleanString.pipe(z.string().min(1)),
  OPENROUTER_API_KEY: cleanString.pipe(z.string().min(1)),
  OPENROUTER_MODEL: z.preprocess((val) => stripQuotes(val) ?? 'google/gemini-2.5-flash', z.string()).default('google/gemini-2.5-flash'),
  OPENROUTER_SITE_URL: z.preprocess((val) => stripQuotes(val) ?? 'https://safeher.biz.id', z.string().url()).default('https://safeher.biz.id'),
  OPENROUTER_APP_NAME: z.preprocess((val) => stripQuotes(val) ?? 'SafeHer', z.string()).default('SafeHer'),
  FIREBASE_PROJECT_ID: cleanString.pipe(z.string().min(1)),
  FIREBASE_CLIENT_EMAIL: cleanString.pipe(z.string().min(1)),
  FIREBASE_PRIVATE_KEY: cleanString
    .transform((val) => val.replace(/\\n/g, '\n'))
    .pipe(z.string().min(1)),
  SOS_RATE_LIMIT_PER_HOUR: z.preprocess((val) => {
    const cleaned = stripQuotes(val);
    return cleaned !== undefined && cleaned !== null && cleaned !== '' ? Number(cleaned) : 5;
  }, z.number()).default(5),
  TRACKING_BATCH_MAX_SIZE: z.preprocess((val) => {
    const cleaned = stripQuotes(val);
    return cleaned !== undefined && cleaned !== null && cleaned !== '' ? Number(cleaned) : 100;
  }, z.number()).default(100),
  AUDIO_MAX_BYTES: z.preprocess((val) => {
    const cleaned = stripQuotes(val);
    return cleaned !== undefined && cleaned !== null && cleaned !== '' ? Number(cleaned) : 10485760;
  }, z.number()).default(10485760),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
