import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { operatorRoutes } from './routes/operator'
import { publicRoutes } from './routes/public'
import type { AppContext } from './types'

const app = new Hono<AppContext>()

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.get('/health', (context) => {
  return context.json({
    ok: true,
    service: 'photobox-api',
    timestamp: new Date().toISOString(),
  })
})

app.route('/api/auth', authRoutes)
app.route('/api/public', publicRoutes)
app.route('/api/operator', operatorRoutes)
app.route('/api/admin', adminRoutes)

export default app
