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

// import { hashPassword, verifyPassword } from './hashPassword' // cập nhật path cho đúng

authRoutes.post('/change-password', async (context) => {
  const authResult = await requireAuth(context)
  if (authResult instanceof Response) {
    return authResult
  }

  const body = (await context.req.json<ChangePasswordRequest>().catch(() => null)) as ChangePasswordRequest | null
  if (!body?.currentPassword || !body?.newPassword) {
    return context.json({ error: 'Invalid request body.' }, 400)
  }

  // 1) Lấy hash hiện tại từ DB
  const row = await context.env.DB.prepare(
    'SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1'
  )
    .bind(authResult.id)
    .first<{ passwordHash: string | null }>()

  const stored = row?.passwordHash ?? ''
  if (!stored) {
    // trường hợp hiếm: user chưa có hash
    return context.json({ error: 'Current password is incorrect.' }, 400)
  }

  // 2) Kiểm tra currentPassword bằng verifyPassword (hỗ trợ cả SHA-256 cũ & PBKDF2 mới)
  const ok = await verifyPassword(body.currentPassword, stored)
  if (!ok) {
    return context.json({ error: 'Current password is incorrect.' }, 400)
  }

  // (khuyến nghị) chặn đổi sang mật khẩu y hệt
  // if (await verifyPassword(body.newPassword, stored)) {
  //   return context.json({ error: 'New password must be different from current password.' }, 400)
  // }

  // 3) Tạo hash mới PBKDF2 cho newPassword
  const nextPasswordHash = await hashPassword(body.newPassword)

  // 4) Lưu vào DB
  await context.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(nextPasswordHash, authResult.id)
    .run()

  return context.json({ success: true })
})

// authRoutes.post('/change-password', async (context) => {
//   const authResult = await requireAuth(context)

//   if (authResult instanceof Response) {
//     return authResult
//   }

//   const body = (await context.req.json<ChangePasswordRequest>().catch(() => null)) as ChangePasswordRequest | null

//   if (!body) {
//     return context.json({ error: 'Invalid request body.' }, 400)
//   }

//   const row = await context.env.DB.prepare(
//     'SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1',
//   )
//     .bind(authResult.id)
//     .first<{ passwordHash: string | null }>()

//   const currentPasswordHash = await hashPassword(body.currentPassword ?? '')

//   if ((row?.passwordHash ?? '') !== currentPasswordHash) {
//     return context.json({ error: 'Current password is incorrect.' }, 400)
//   }

//   const nextPasswordHash = await hashPassword(body.newPassword ?? '')

//   await context.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
//     .bind(nextPasswordHash, authResult.id)
//     .run()

//   return context.json({ success: true })
// })
