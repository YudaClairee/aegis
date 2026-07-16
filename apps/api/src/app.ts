import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';

import { env } from './lib/env';
import { authRouter } from './routes/auth';
import { contactsRouter } from './routes/contacts';
import { contactLinksRouter } from './routes/contact-links';
import { sosRouter } from './routes/sos';
import { incidentsRouter } from './routes/incidents';
import { aiRouter } from './routes/ai';
import { trackingRouter } from './routes/tracking';


// Create a new Hono instance with base path /api
const app = new Hono().basePath('/api');

// Allowed origins for browser-based clients (e.g. a future web admin panel).
// The React Native app isn't affected by CORS at all, since it doesn't run in a browser.
// Auth uses a Bearer token (Authorization header), not cookies, so credentials aren't required.
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: false,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'safeher-api',
  });
});

// Route mounting
app.route('/auth', authRouter);
app.route('/contacts', contactsRouter);
app.route('/contact-links', contactLinksRouter);
app.route('/sos', sosRouter);
app.route('/incidents', incidentsRouter);
app.route('/ai', aiRouter);
app.route('/tracking', trackingRouter);


// 404 Not Found Handler
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Route not found',
    },
  }, 404);
});

// Global Error Handler
app.onError((err, c) => {
  console.error('🔥 Server Error:', err);

  if (err instanceof HTTPException) {
    let message = err.message;
    let code: string | undefined = undefined;

    // Check if the message is a stringified JSON array of Zod validation issues
    try {
      const parsed = JSON.parse(err.message);
      if (Array.isArray(parsed)) {
        // Format Zod issues nicely
        message = 'Validation failed: ' + parsed.map((issue: any) => {
          const field = issue.path.join('.');
          return `${field ? `'${field}': ` : ''}${issue.message}`;
        }).join(', ');
        code = 'VALIDATION_ERROR';
      }
    } catch {
      // Message is not a JSON string, keep as-is
    }

    return c.json({
      error: {
        message,
        ...(code ? { code } : {}),
      },
    }, err.status);
  }

  // Fallback for generic/unexpected errors to hide internal implementation details
  return c.json({
    error: {
      message: 'Internal server error',
    },
  }, 500);
});

export { app };
