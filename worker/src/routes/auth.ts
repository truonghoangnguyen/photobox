import { Hono } from 'hono'
import { verifyPassword } from '../auth'

import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  SessionResponse,
} from '../../../shared/contracts'
import { createSession, deleteSession, hashPassword, requireAuth } from '../auth'
import type { AppContext } from '../types'

export const authRoutes = new Hono<AppContext>()

authRoutes.post('/login', async (context) => {
  const body = (await context.req.json<LoginRequest>().catch(() => null)) as LoginRequest | null

  if (!body?.username) {
    return context.json({ error: 'Username is required.' }, 400)
  }

  const user = await context.env.DB.prepare(
    'SELECT id, username, name, role, password_hash AS passwordHash FROM users WHERE username = ? LIMIT 1',
  )
    .bind(body.username)
    .first<{ id: string; username: string; name: string; role: string; passwordHash: string | null }>()

  if (!user) {
    return context.json({ error: 'Invalid username or password.' }, 401)
  }

  // const passwordHash = await hashPassword(body.password ?? '')

  // if ((user.passwordHash ?? '') !== passwordHash) {
  //   return context.json({ error: 'Invalid username or password.' }, 401)
  // }

  const ok = await verifyPassword(
    body.password ?? '',
    user.passwordHash ?? ''
  )

  if (!ok) {
    return context.json({ error: 'Invalid username or password.' }, 401)
  }


  const token = await createSession(context, user.id)
  const authResult = await requireAuth({
    env: context.env,
    req: {
      header(name: string) {
        return name === 'Authorization' ? `Bearer ${token}` : undefined
      },
    },
    json: context.json.bind(context),
  })

  if (authResult instanceof Response) {
    return authResult
  }

  return context.json<LoginResponse>({
    token,
    user: authResult,
  })
})

authRoutes.get('/me', async (context) => {
  const authResult = await requireAuth(context)

  if (authResult instanceof Response) {
    return authResult
  }

  return context.json<SessionResponse>({
    user: authResult,
  })
})

authRoutes.post('/logout', async (context) => {
  const header = context.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (token) {
    await deleteSession(context, token)
  }

  return context.json({ success: true })
})

authRoutes.post('/change-password', async (context) => {
  const authResult = await requireAuth(context)

  if (authResult instanceof Response) {
    return authResult
  }

  const body = (await context.req.json<ChangePasswordRequest>().catch(() => null)) as ChangePasswordRequest | null

  if (!body) {
    return context.json({ error: 'Invalid request body.' }, 400)
  }

  const row = await context.env.DB.prepare(
    'SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1',
  )
    .bind(authResult.id)
    .first<{ passwordHash: string | null }>()

  const currentPasswordHash = await hashPassword(body.currentPassword ?? '')

  if ((row?.passwordHash ?? '') !== currentPasswordHash) {
    return context.json({ error: 'Current password is incorrect.' }, 400)
  }

  const nextPasswordHash = await hashPassword(body.newPassword ?? '')

  await context.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(nextPasswordHash, authResult.id)
    .run()

  return context.json({ success: true })
})
