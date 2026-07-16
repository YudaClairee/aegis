import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { sosRateLimitMiddleware } from '../middleware/rate-limit';
import { checkIdempotency, saveIdempotency } from '../services/idempotency';
import { assertIsIncidentOwner, assertCanAccessIncident } from '../services/contact-access';
import { 
  sendSOSNotification, 
  sendNoResponseNotification, 
  sendResolutionNotification, 
  sendAISummaryNotification,
  fetchFamilyTokens 
} from '../services/fcm';
import { analyzeIncidentAudio } from '../services/openrouter';
import { SOSTriggerSchema, ResolveIncidentSchema } from '@aegis/shared';
import { env } from '../lib/env';

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

// 2. POST /:id/audio - Upload audio recording and run AI analysis pipeline
sosRouter.post('/:id/audio', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('id');

  // Verify incident belongs to the user
  const incident = await assertIsIncidentOwner(userId, incidentId);

  // Reject upload if incident is already resolved
  if (incident.status === 'resolved' || incident.status === 'false_alarm') {
    throw new HTTPException(400, { message: 'Cannot upload audio to a resolved or false alarm incident' });
  }

  const body = await c.req.parseBody();
  const audioFile = body.audio;

  if (!audioFile || !(audioFile instanceof File)) {
    throw new HTTPException(400, { message: 'Audio file is required in "audio" multipart field' });
  }

  // Validate file size
  if (audioFile.size > env.AUDIO_MAX_BYTES) {
    throw new HTTPException(413, {
      message: `Audio file too large (${(audioFile.size / (1024 * 1024)).toFixed(2)} MB). Max limit is ${(
        env.AUDIO_MAX_BYTES / (1024 * 1024)
      ).toFixed(0)} MB.`,
    });
  }

  // Validate MIME type
  const allowedMimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
  if (!allowedMimeTypes.includes(audioFile.type)) {
    throw new HTTPException(415, {
      message: `Unsupported audio type "${audioFile.type}". Allowed formats: mpeg, mp4, wav, webm, m4a`,
    });
  }

  // Read arrayBuffer and convert to Buffer
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Determine file extension
  const ext = audioFile.name ? audioFile.name.split('.').pop() : 'm4a';
  const filePath = `${userId}/${incidentId}.${ext}`;

  // Upload to Supabase Storage
  const { data: storageData, error: storageErr } = await supabase.storage
    .from('incident-audio')
    .upload(filePath, audioBuffer, {
      contentType: audioFile.type,
      upsert: true,
    });

  if (storageErr || !storageData) {
    throw new HTTPException(500, { message: storageErr?.message || 'Failed to upload audio file to storage' });
  }

  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from('incident-audio')
    .getPublicUrl(filePath);

  const audioUrl = publicUrlData?.publicUrl || '';

  // Run AI Analysis Pipeline
  let transcript: string | null = null;
  let aiSummary: any = null;
  let riskScore: number | null = null;
  let classification: any = null;
  let aiErrorOccurred = false;

  try {
    const aiResult = await analyzeIncidentAudio({
      audioBuffer,
      mimeType: audioFile.type,
      incidentId,
      triggerType: incident.trigger_type,
      location: {
        latitude: incident.latitude,
        longitude: incident.longitude,
      },
    });

    transcript = aiResult.transcript;
    aiSummary = aiResult.aiSummary;
    riskScore = aiResult.aiSummary.risk;
    classification = aiResult.aiSummary.classification;
  } catch (aiErr) {
    console.error('❌ AI Analysis pipeline failed (saving audio URL and continuing):', aiErr);
    aiErrorOccurred = true;
  }

  // Update incident record in database.
  // Transition incident status to 'active' once audio processing is kicked off/completed.
  const updatePayload: any = {
    audio_url: audioUrl,
    status: 'active',
  };

  if (!aiErrorOccurred) {
    updatePayload.transcript = transcript;
    updatePayload.ai_summary = aiSummary;
    updatePayload.risk_score = riskScore;
    updatePayload.classification = classification;
  }

  const { data: updatedIncident, error: updateErr } = await supabase
    .from('incidents')
    .update(updatePayload)
    .eq('id', incidentId)
    .select()
    .single();

  if (updateErr || !updatedIncident) {
    throw new HTTPException(500, { message: updateErr?.message || 'Failed to update incident record' });
  }

  // If AI pipeline succeeded, notify emergency contacts with the AI summary update
  if (!aiErrorOccurred && transcript && aiSummary) {
    sendAISummaryNotification({
      incidentId,
      victimUserId: userId,
      classification: classification || 'unknown',
      riskScore: riskScore || 0,
      summary: aiSummary.summary || '',
    }).catch((err) => console.error('FCM AI notification background failure:', err));
  }

  return c.json({
    incident: mapIncidentRow(updatedIncident),
    aiAnalysisStatus: aiErrorOccurred ? 'failed' : 'success',
  });
});

// 3. PUT /:id/resolve - Resolve or mark an incident as false alarm
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

// 4. GET /:id/status - Get basic/limited incident status
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
