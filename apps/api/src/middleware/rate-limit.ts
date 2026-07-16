import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { env } from '../lib/env';

// In-memory store: userId -> array of request timestamps (in milliseconds)
const requestLog = new Map<string, number[]>();

export const sosRateLimitMiddleware = createMiddleware(async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    await next();
    return;
  }

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  let timestamps = requestLog.get(userId) || [];
  
  // Filter out timestamps older than one hour
  timestamps = timestamps.filter((t) => t > oneHourAgo);

  if (timestamps.length >= env.SOS_RATE_LIMIT_PER_HOUR) {
    throw new HTTPException(429, {
      message: `SOS rate limit exceeded. You can only trigger SOS ${env.SOS_RATE_LIMIT_PER_HOUR} times per hour.`,
    });
  }

  timestamps.push(now);
  requestLog.set(userId, timestamps);

  await next();
});
