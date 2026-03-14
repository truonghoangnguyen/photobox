import { Hono } from 'hono'
import type {
  CreateUserRequest,
  CreateUserResponse,
  ResetPasswordRequest,
  StationListResponse,
  UserListResponse,
} from '../../../shared/contracts'
import { hashPassword, requireAdmin, toManagedUser } from '../auth'
import type { AppContext, ManagedUserRow, StationRow } from '../types'
import { toStationSummary } from '../types'

export const adminRoutes = new Hono<AppContext>()

adminRoutes.get('/stations', async (context) => {
  const authResult = await requireAdmin(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const rows = await context.env.DB.prepare(
    'SELECT id, slug, name, location, status FROM stations ORDER BY created_at DESC',
  ).all<StationRow>()

  return context.json<StationListResponse>({
    stations: (rows.results ?? []).map(toStationSummary),
  })
})

adminRoutes.get('/users', async (context) => {
  const authResult = await requireAdmin(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const rows = await context.env.DB.prepare(
    `
      SELECT
        u.id,
        u.username,
        u.name,
        u.role,
        su.station_id AS stationId,
        s.slug AS stationSlug,
        s.name AS stationName,
        u.created_at AS createdAt
      FROM users u
      LEFT JOIN station_users su ON su.user_id = u.id
      LEFT JOIN stations s ON s.id = su.station_id
      ORDER BY u.created_at DESC
    `,
  ).all<ManagedUserRow>()

  return context.json<UserListResponse>({
    users: (rows.results ?? []).map(toManagedUser),
  })
})

adminRoutes.post('/users', async (context) => {
  const authResult = await requireAdmin(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const body = (await context.req.json<CreateUserRequest>().catch(() => null)) as CreateUserRequest | null

  if (!body?.username || !body.name || !body.stationId) {
    return context.json({ error: 'username, name, and stationId are required.' }, 400)
  }

  const existing = await context.env.DB.prepare(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
  )
    .bind(body.username)
    .first<{ id: string }>()

  if (existing) {
    return context.json({ error: 'Username already exists.' }, 409)
  }

  const station = await context.env.DB.prepare(
    'SELECT id, slug, name FROM stations WHERE id = ? LIMIT 1',
  )
    .bind(body.stationId)
    .first<{ id: string; slug: string; name: string }>()

  if (!station) {
    return context.json({ error: 'Station not found.' }, 404)
  }

  const userId = crypto.randomUUID()
  const mappingId = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password ?? '')

  await context.env.DB.prepare(
    `
      INSERT INTO users (id, email, username, name, role, password_hash)
      VALUES (?, ?, ?, ?, 'station_operator', ?)
    `,
  )
    .bind(userId, `${body.username}@photobox.local`, body.username, body.name, passwordHash)
    .run()

  await context.env.DB.prepare(
    'INSERT INTO station_users (id, station_id, user_id) VALUES (?, ?, ?)',
  )
    .bind(mappingId, station.id, userId)
    .run()

  return context.json<CreateUserResponse>({
    user: {
      id: userId,
      username: body.username,
      name: body.name,
      role: 'station_operator',
      stationId: station.id,
      stationSlug: station.slug,
      stationName: station.name,
      createdAt: new Date().toISOString(),
    },
  }, 201)
})

adminRoutes.delete('/users/:id', async (context) => {
  const authResult = await requireAdmin(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const id = context.req.param('id')

  if (id === authResult.id) {
    return context.json({ error: 'You cannot delete your own admin account.' }, 400)
  }

  await context.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await context.env.DB.prepare('DELETE FROM station_users WHERE user_id = ?').bind(id).run()
  const result = await context.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()

  if (result.meta.changes === 0) {
    return context.json({ error: 'User not found.' }, 404)
  }

  return context.json({ success: true })
})

adminRoutes.post('/users/:id/reset-password', async (context) => {
  const authResult = await requireAdmin(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const id = context.req.param('id')
  const body = (await context.req.json<ResetPasswordRequest>().catch(() => null)) as ResetPasswordRequest | null

  if (!body) {
    return context.json({ error: 'Invalid request body.' }, 400)
  }

  const user = await context.env.DB.prepare(
    'SELECT id, role FROM users WHERE id = ? LIMIT 1',
  )
    .bind(id)
    .first<{ id: string; role: string }>()

  if (!user) {
    return context.json({ error: 'User not found.' }, 404)
  }

  if (user.role === 'super_admin') {
    return context.json({ error: 'Resetting admin passwords from this endpoint is disabled.' }, 400)
  }

  const passwordHash = await hashPassword(body.password ?? '')

  await context.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, id)
    .run()

  await context.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()

  return context.json({ success: true })
})
