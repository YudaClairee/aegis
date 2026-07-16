import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { assertCanAccessIncident } from '../services/contact-access';

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
    triggerContext: row.trigger_context || null,
    resolvedAt: row.resolved_at || null,
    resolutionNotes: row.resolution_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const incidentsRouter = new Hono<{ Variables: AuthVariables }>();

// All routes require authentication
incidentsRouter.use('*', authMiddleware);

// 1. GET / - List user's own incidents and linked family active/shared incidents
incidentsRouter.get('/', async (c) => {
  const userId = c.get('userId');

  // Query own incidents
  const { data: ownData, error: ownErr } = await supabase
    .from('incidents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (ownErr) {
    throw new HTTPException(500, { message: ownErr.message });
  }

  // Query victims this user is linked to
  const { data: links, error: linksErr } = await supabase
    .from('emergency_contacts')
    .select('user_id')
    .eq('linked_user_id', userId)
    .eq('invite_status', 'accepted');

  let familyIncidents: any[] = [];
  if (!linksErr && links && links.length > 0) {
    const linkedVictimIds = links.map((l) => l.user_id);
    const { data: familyData, error: familyErr } = await supabase
      .from('incidents')
      .select('*')
      .in('user_id', linkedVictimIds)
      .order('created_at', { ascending: false });
    
    if (!familyErr && familyData) {
      familyIncidents = familyData;
    }
  }

  return c.json({
    ownIncidents: (ownData || []).map(mapIncidentRow),
    familyIncidents: familyIncidents.map(mapIncidentRow),
  });
});

// 2. GET /:id - Get full detail for owner or limited safe subset for family
incidentsRouter.get('/:id', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('id');

  // Verify access authorization
  await assertCanAccessIncident(userId, incidentId);

  const { data: incident, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', incidentId)
    .single();

  if (error || !incident) {
    throw new HTTPException(404, { message: 'Incident not found' });
  }

  const isOwner = incident.user_id === userId;

  if (isOwner) {
    // Return full incident detail
    return c.json({ incident: mapIncidentRow(incident) });
  } else {
    // Return limited/safe subset of incident detail for family member
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', incident.user_id)
      .single();
    
    const victimName = profile?.full_name || 'User';

    return c.json({
      incident: {
        id: incident.id,
        status: incident.status,
        victimName,
        latitude: incident.latitude,
        longitude: incident.longitude,
        accuracy: incident.accuracy,
        riskScore: incident.risk_score,
        classification: incident.classification || null,
        aiSummary: incident.ai_summary || null,
        transcript: incident.transcript || null,
        resolvedAt: incident.resolved_at || null,
        createdAt: incident.created_at,
      },
    });
  }
});

// 3. GET /:id/locations - List incident's location history chronologically
incidentsRouter.get('/:id/locations', async (c) => {
  const userId = c.get('userId');
  const incidentId = c.req.param('id');

  // Verify access authorization
  await assertCanAccessIncident(userId, incidentId);

  const { data: locations, error } = await supabase
    .from('location_history')
    .select('*')
    .eq('incident_id', incidentId)
    .order('recorded_at', { ascending: true });

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  const mappedLocations = (locations || []).map((loc) => ({
    id: loc.id,
    incidentId: loc.incident_id,
    latitude: loc.latitude,
    longitude: loc.longitude,
    speed: loc.speed,
    heading: loc.heading,
    accuracy: loc.accuracy,
    recordedAt: loc.recorded_at,
  }));

  return c.json({ locations: mappedLocations });
});

export { incidentsRouter };
