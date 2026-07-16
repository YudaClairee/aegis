import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { assertIsIncidentOwner, assertCanAccessIncident } from '../services/contact-access';
import { TrackingLocationSchema, TrackingBatchSchema } from '@aegis/shared';

const trackingRouter = new Hono<{ Variables: AuthVariables }>();

// All tracking routes require authentication
trackingRouter.use('*', authMiddleware);

/**
 * 1. POST /location - Persist a single location coordinate update.
 * Access: Incident Owner only.
 * Constraint: Incident must be in 'triggered' or 'active' status.
 */
trackingRouter.post('/location', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parseResult = TrackingLocationSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const { incidentId, latitude, longitude, speed, heading, accuracy } = parseResult.data;

  // Verify ownership of the incident
  const incident = await assertIsIncidentOwner(userId, incidentId);

  // Verify that the incident is active
  if (incident.status !== 'triggered' && incident.status !== 'active') {
    throw new HTTPException(400, { message: 'Cannot update tracking for an inactive or resolved incident' });
  }

  // Insert location history entry
  const { data: locationEntry, error: insertErr } = await supabase
    .from('location_history')
    .insert({
      incident_id: incidentId,
      latitude,
      longitude,
      speed: speed !== undefined ? speed : null,
      heading: heading !== undefined ? heading : null,
      accuracy,
    })
    .select()
    .single();

  if (insertErr || !locationEntry) {
    throw new HTTPException(500, { message: insertErr?.message || 'Failed to persist location history' });
  }

  return c.json({
    success: true,
    location: {
      id: locationEntry.id,
      incidentId: locationEntry.incident_id,
      latitude: locationEntry.latitude,
      longitude: locationEntry.longitude,
      speed: locationEntry.speed,
      heading: locationEntry.heading,
      accuracy: locationEntry.accuracy,
      recordedAt: locationEntry.recorded_at,
    },
  }, 201);
});

/**
 * 2. POST /batch - Persist a batch of location coordinates (up to 100 entries).
 * Access: Incident Owner only.
 * Constraint: Incident must be in 'triggered' or 'active' status.
 */
trackingRouter.post('/batch', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parseResult = TrackingBatchSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const { incidentId, locations } = parseResult.data;

  // Verify ownership of the incident
  const incident = await assertIsIncidentOwner(userId, incidentId);

  // Verify that the incident is active
  if (incident.status !== 'triggered' && incident.status !== 'active') {
    throw new HTTPException(400, { message: 'Cannot update tracking for an inactive or resolved incident' });
  }

  // Map locations format to database columns
  const rows = locations.map((loc) => ({
    incident_id: incidentId,
    latitude: loc.latitude,
    longitude: loc.longitude,
    speed: loc.speed !== undefined ? loc.speed : null,
    heading: loc.heading !== undefined ? loc.heading : null,
    accuracy: loc.accuracy,
    recorded_at: loc.timestamp,
  }));

  // Batch insert into Supabase
  const { data: insertedEntries, error: insertErr } = await supabase
    .from('location_history')
    .insert(rows)
    .select();

  if (insertErr || !insertedEntries) {
    throw new HTTPException(500, { message: insertErr?.message || 'Failed to persist location batch' });
  }

  return c.json({
    success: true,
    count: insertedEntries.length,
  }, 201);
});

/**
 * 3. GET /:incidentId/access - Verify authorization to access tracking data for an incident.
 * Access: Owner or linked emergency contact with 'accepted' invite status.
 */
trackingRouter.get('/:incidentId/access', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('incidentId');

  // Verify if the user has permission to access the incident
  const accessResult = await assertCanAccessIncident(userId, incidentId);

  // Determine user's role (owner vs linked contact) based on matching user_id field
  const isOwner = accessResult.user_id === userId;

  return c.json({
    authorized: true,
    role: isOwner ? 'owner' : 'family',
  });
});

export { trackingRouter };
