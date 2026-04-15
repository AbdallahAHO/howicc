import { serve } from '@hono/node-server'
import app from './index'

serve({
  fetch: app.fetch,
  port: 8787,
})

console.log('HowiCC API dev server running on http://localhost:8787')
