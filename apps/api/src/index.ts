import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { env } from './lib/env'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './services/supabase'
import { VERSION } from '@aegis/shared'

const app = new Hono()

function createAuthClient(token?: string) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  })
  return client
}

async function getUserIdFromReq(c: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const client = createAuthClient(token)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

app.get('/health', (c) => c.json({ status: 'ok', service: 'safeher-api', sharedVersion: VERSION }))

// Get incident detail
app.get('/api/incidents/:id', async (c) => {
  const id = c.req.param('id')
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const client = createAuthClient(token)

  const { data, error } = await client.from('incidents').select('*').eq('id', id).maybeSingle()
  if (error) return c.json({ message: error.message }, 500)
  if (!data) return c.json({ message: 'Not found' }, 404)

  const incident = {
    id: data.id,
    userId: data.user_id,
    status: data.status,
    triggerType: data.trigger_type,
    location: {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      address: data.address,
    },
    audioUrl: data.audio_url,
    transcript: data.transcript,
    aiSummary: data.ai_summary,
    riskScore: data.risk_score,
    classification: data.classification,
    resolvedAt: data.resolved_at,
    createdAt: data.created_at,
  }

  return c.json(incident)
})

// Update incident (resolve/reopen or partial updates)
app.patch('/api/incidents/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  // allow only specific fields
  const allowed: Record<string, any> = {}
  if (body.status) allowed.status = body.status
  if (body.resolvedAt !== undefined) allowed.resolved_at = body.resolvedAt
  if (body.resolutionNote !== undefined) allowed.resolution_notes = body.resolutionNote
  if (body.classification !== undefined) allowed.classification = body.classification
  if (body.riskScore !== undefined) allowed.risk_score = body.riskScore

  const { data, error } = await supabase.from('incidents').update(allowed).eq('id', id).select().maybeSingle()
  if (error) return c.json({ message: error.message }, 500)
  return c.json({ incident: data })
})

// Re-run AI processing (enqueue)
app.post('/api/incidents/:id/reprocess', async (c) => {
  const id = c.req.param('id')
  // For now, just mark updated_at to trigger downstream processors or return accepted
  const { error } = await supabase.from('incidents').update({ updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return c.json({ message: error.message }, 500)
  return c.json({ status: 'queued' })
})

// Comments: list and post
app.get('/api/incidents/:id/comments', async (c) => {
  const id = c.req.param('id')
  const { data, error } = await supabase.from('incident_comments').select('*').eq('incident_id', id).order('created_at', { ascending: false })
  if (error) return c.json({ message: error.message }, 500)
  return c.json({ comments: data })
})

app.post('/api/incidents/:id/comments', async (c) => {
  const id = c.req.param('id')
  const { text } = await c.req.json()
  const userId = await getUserIdFromReq(c)
  if (!userId) return c.json({ message: 'Unauthorized' }, 401)

  const { data, error } = await supabase.from('incident_comments').insert({ incident_id: id, user_id: userId, text }).select().maybeSingle()
  if (error) return c.json({ message: error.message }, 500)
  return c.json({ comment: data })
})

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🛡️ SafeHer API running on http://localhost:${info.port}`)
})

export type AppType = typeof app
export { app }
