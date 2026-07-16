import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';

import { authRouter } from './routes/auth';

// Create a new Hono instance with base path /api
const app = new Hono().basePath('/api');

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // Allow all origins for API development.
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
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
    return c.json({
      error: {
        message: err.message,
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
