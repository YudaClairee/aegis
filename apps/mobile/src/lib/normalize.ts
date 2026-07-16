import type { Incident } from '@aegis/shared';

export function normalizeIncident(raw: any): Incident {
  if (!raw) return raw;
  return {
    id: raw.id,
    userId: raw.userId || raw.user_id || '',
    status: raw.status,
    triggerType: raw.triggerType || raw.trigger_type || 'manual',
    audioUrl: raw.audioUrl || raw.audio_url || null,
    transcript: raw.transcript || null,
    aiSummary: raw.aiSummary || raw.ai_summary || null,
    riskScore: raw.riskScore !== undefined ? raw.riskScore : (raw.risk_score !== undefined ? raw.risk_score : null),
    classification: raw.classification || null,
    resolvedAt: raw.resolvedAt || raw.resolved_at || null,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    triggerContext: raw.triggerContext || raw.trigger_context || null,
    location: raw.location ? {
      latitude: raw.location.latitude,
      longitude: raw.location.longitude,
      accuracy: raw.location.accuracy ?? undefined,
      speed: raw.location.speed ?? null,
      heading: raw.location.heading ?? null,
      address: raw.location.address ?? null,
    } : {
      latitude: raw.latitude ?? 0,
      longitude: raw.longitude ?? 0,
      accuracy: raw.accuracy ?? undefined,
      speed: raw.speed ?? null,
      heading: raw.heading ?? null,
      address: raw.address ?? null,
    }
  };
}
