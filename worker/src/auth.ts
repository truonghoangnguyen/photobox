import type { AuthUser, ManagedUser } from '../../shared/contracts'
import type { AppContext, ManagedUserRow, SessionUserRow } from './types'
import { toAuthUser } from './types'

// hashPassword.ts
const ITERATIONS = 200_000
const KEY_LEN = 32 // 256-bit

function toHex(buf: Uint8Array) {
  return Array.from(buf)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string) {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

/**
 * Dùng khi tạo / reset password
 * Trả về string để lưu DB
 */
export async function hashPassword(password: string) {
  const enc = new TextEncoder()

  // salt ngẫu nhiên cho mỗi user
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    KEY_LEN * 8
  )

  // lưu dạng: pbkdf2$iterations$salt$hash
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`
}

/**
 * Dùng khi login
 */
export async function verifyPassword(
  password: string,
  storedHash: string
) {
  // fallback cho dữ liệu cũ (SHA-256)
  if (!storedHash.startsWith('pbkdf2$')) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password)
    )
    const hex = toHex(new Uint8Array(digest))
    return hex === storedHash
  }

  const enc = new TextEncoder()
  const [, iter, saltHex, hashHex] = storedHash.split('$')

  const salt = fromHex(saltHex)
  const iterations = Number(iter)

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    hashHex.length * 4
  )

  return toHex(new Uint8Array(bits)) === hashHex
}

// async function sha256(value: string) {
//   const bytes = new TextEncoder().encode(value)
//   const digest = await crypto.subtle.digest('SHA-256', bytes)
//   return Array.from(new Uint8Array(digest))
//     .map((part) => part.toString(16).padStart(2, '0'))
//     .join('')
// }

// export async function hashPassword(password: string) {
//   return await sha256(password)
// }

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
