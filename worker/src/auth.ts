import type { AuthUser, ManagedUser } from '../../shared/contracts'
import type { AppContext, ManagedUserRow, SessionUserRow } from './types'
import { toAuthUser } from './types'

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string) {
  return await sha256(password)
}

function getBearerToken(context: Parameters<typeof requireAuth>[0]) {
  const header = context.req.header('Authorization')

  if (!header?.startsWith('Bearer ')) {
    return null
  }

  return header.slice('Bearer '.length).trim()
}

export async function createSession(context: Parameters<typeof requireAuth>[0], userId: string) {
  const token = crypto.randomUUID()
  const sessionId = crypto.randomUUID()

  await context.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
  )
    .bind(sessionId, userId, token)
    .run()

  return token
}

export async function deleteSession(context: Parameters<typeof requireAuth>[0], token: string) {
  await context.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
}

export async function requireAuth(context: {
  env: AppContext['Bindings']
  req: { header: (name: string) => string | undefined }
  json: <T>(body: T, status?: number) => Response
}) {
  const token = getBearerToken(context)

  if (!token) {
    return context.json({ error: 'Missing Authorization token.' }, 401)
  }

  const row = await context.env.DB.prepare(
    `
      SELECT
        u.id,
        u.username,
        u.name,
        u.role,
        su.station_id AS stationId,
        s.slug AS stationSlug,
        s.name AS stationName
      FROM sessions se
      JOIN users u ON u.id = se.user_id
      LEFT JOIN station_users su ON su.user_id = u.id
      LEFT JOIN stations s ON s.id = su.station_id
      WHERE se.token = ?
      LIMIT 1
    `,
  )
    .bind(token)
    .first<SessionUserRow>()

  if (!row) {
    return context.json({ error: 'Invalid or expired session.' }, 401)
  }

  return toAuthUser(row)
}

export async function requireAdmin(context: Parameters<typeof requireAuth>[0]) {
  const authResult = await requireAuth(context)

  if (authResult instanceof Response) {
    return authResult
  }

  if (authResult.role !== 'super_admin') {
    return context.json({ error: 'Admin access required.' }, 403)
  }

  return authResult
}

export function toManagedUser(row: ManagedUserRow): ManagedUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role === 'super_admin' ? 'super_admin' : 'station_operator',
    stationId: row.stationId,
    stationSlug: row.stationSlug,
    stationName: row.stationName,
    createdAt: row.createdAt,
  }
}

export type AuthResult = AuthUser | Response
