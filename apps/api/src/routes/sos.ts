import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { sosRateLimitMiddleware } from '../middleware/rate-limit';
import { checkIdempotency, saveIdempotency } from '../services/idempotency';
import { assertIsIncidentOwner, assertCanAccessIncident } from '../services/contact-access';
import { sendSOSNotification, sendNoResponseNotification, sendResolutionNotification, fetchFamilyTokens } from '../services/fcm';
import { SOSTriggerSchema, ResolveIncidentSchema } from '@aegis/shared';

// Helper to map DB row to response incident structure
function mapIncidentRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    triggerType: row.trigger_type,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    address: row.address || null,
    audioUrl: row.audio_url || null,
    transcript: row.transcript || null,
    aiSummary: row.ai_summary || null,
    riskScore: row.risk_score,
    classification: row.classification || null,
    keywordsDetected: row.keywords_detected || [],
    resolvedAt: row.resolved_at || null,
    resolutionNotes: row.resolution_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const sosRouter = new Hono<{ Variables: AuthVariables }>();

// All SOS endpoints require authentication
sosRouter.use('*', authMiddleware);

// 1. POST /trigger - Trigger a new SOS incident (with rate-limiting and idempotency)
sosRouter.post('/trigger', sosRateLimitMiddleware, async (c) => {
  const userId = c.get('userId');
  const idempotencyKey = c.req.header('Idempotency-Key');

  // Check idempotency cache first
  if (idempotencyKey) {
    const cachedResponse = await checkIdempotency(userId, idempotencyKey);
    if (cachedResponse) {
      console.log(`ℹ️ Returning cached response for idempotency key: ${idempotencyKey}`);
      return c.json(cachedResponse, 201);
    }
  }

  const body = await c.req.json();
  const parseResult = SOSTriggerSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const { triggerType, location, riskScore, keywordsDetected, triggerContext } = parseResult.data;

  // Create incident in database
  const { data: incident, error: insertErr } = await supabase
    .from('incidents')
    .insert({
      user_id: userId,
      status: 'triggered',
      trigger_type: triggerType,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy !== undefined ? location.accuracy : null,
      speed: location.speed !== undefined ? location.speed : null,
      heading: location.heading !== undefined ? location.heading : null,
      risk_score: riskScore !== undefined ? riskScore : null,
      keywords_detected: keywordsDetected || null,
      trigger_context: triggerContext || {},
    })
    .select()
    .single();

  if (insertErr || !incident) {
    throw new HTTPException(500, { message: insertErr?.message || 'Failed to create incident' });
  }

  // Fetch linked family tokens and send FCM notification asynchronously
  let contactsNotified = 0;
  try {
    const tokens = await fetchFamilyTokens(userId);
    contactsNotified = tokens.length;

    if (tokens.length > 0) {
      // Get victim profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      const victimName = profile?.full_name || 'User';

      if (triggerType === 'no_response') {
        sendNoResponseNotification({
          incidentId: incident.id,
          victimUserId: userId,
          victimName,
        }).catch((err) => console.error('FCM NoResponse notification background failure:', err));
      } else {
        sendSOSNotification({
          incidentId: incident.id,
          victimUserId: userId,
          victimName,
          triggerType,
        }).catch((err) => console.error('FCM SOS notification background failure:', err));
      }
    }
  } catch (fcmError) {
    console.error('⚠️ Failed to dispatch FCM notifications on SOS trigger:', fcmError);
  }

  const responseBody = {
    incident: mapIncidentRow(incident),
    message: 'SOS triggered. Emergency contacts notified.',
    contactsNotified,
  };

  // Save response to idempotency key
  if (idempotencyKey) {
    await saveIdempotency(userId, idempotencyKey, responseBody);
  }

  return c.json(responseBody, 201);
});

// 2. PUT /:id/resolve - Resolve or mark an incident as false alarm
sosRouter.put('/:id/resolve', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('id');
  const body = await c.req.json();

  const parseResult = ResolveIncidentSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const { resolution, notes } = parseResult.data;

  // Verify incident exists and belongs to the user
  const incident = await assertIsIncidentOwner(userId, incidentId);

  // Check state: only allowed if status is triggered or active
  if (incident.status === 'resolved' || incident.status === 'false_alarm') {
    throw new HTTPException(400, { message: 'Incident is already resolved or marked as false alarm' });
  }

  // Update status in DB
  const { data: updatedIncident, error: updateErr } = await supabase
    .from('incidents')
    .update({
      status: resolution,
      resolution_notes: notes || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
    .select()
    .single();

  if (updateErr || !updatedIncident) {
    throw new HTTPException(500, { message: updateErr?.message || 'Failed to resolve incident' });
  }

  // Send resolution notification to family async
  sendResolutionNotification({
    incidentId,
    victimUserId: userId,
    type: resolution === 'false_alarm' ? 'false_alarm' : 'incident_resolved',
  }).catch((err) => console.error('FCM resolution notification background failure:', err));

  return c.json({ incident: mapIncidentRow(updatedIncident) });
});

// 3. GET /:id/status - Get basic/limited incident status
sosRouter.get('/:id/status', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('id');

  // Verify user can access the incident (either as victim owner or linked family member)
  await assertCanAccessIncident(userId, incidentId);

  const { data: incident, error } = await supabase
    .from('incidents')
    .select('id, status, risk_score, classification, created_at, resolved_at')
    .eq('id', incidentId)
    .single();

  if (error || !incident) {
    throw new HTTPException(404, { message: 'Incident not found' });
  }

  return c.json({
    incident: {
      id: incident.id,
      status: incident.status,
      riskScore: incident.risk_score,
      classification: incident.classification || null,
      createdAt: incident.created_at,
      resolvedAt: incident.resolved_at || null,
    },
  });
});

export { sosRouter };
