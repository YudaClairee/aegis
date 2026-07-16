import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { VERSION } from '@aegis/shared'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok', service: 'safeher-api', sharedVersion: VERSION }))

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🛡️ SafeHer API running on http://localhost:${info.port}`)
})

export type AppType = typeof app
export { app }
