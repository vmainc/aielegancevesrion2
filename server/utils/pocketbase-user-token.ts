import { createError, getHeader, type H3Event } from 'h3'
import { resolvePocketBaseAdmin } from '~/server/utils/server-env'

/**
 * Resolve PocketBase user id from `Authorization: Bearer <users_token>`.
 */
export async function getPocketBaseUserIdFromRequest (event: H3Event): Promise<string> {
  const raw = getHeader(event, 'authorization') || getHeader(event, 'Authorization') || ''
  const m = raw.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1]?.trim()
  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing Authorization Bearer token' })
  }

  const config = useRuntimeConfig()
  const admin = resolvePocketBaseAdmin(config)
  const base =
    admin.internalUrl ||
    String(config.pocketbaseInternalUrl || '').replace(/\/+$/, '') ||
    String(config.public.pocketbaseUrl || '').replace(/\/+$/, '')

  if (!base) {
    throw createError({ statusCode: 500, message: 'PocketBase URL not configured' })
  }

  try {
    const res = await fetch(`${base}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || res.statusText)
    }
    const data = (await res.json()) as { record?: { id?: string } }
    const id = data.record?.id
    if (!id) {
      throw new Error('No user id in auth response')
    }
    return id
  } catch (e: any) {
    throw createError({
      statusCode: 401,
      message: e?.message || 'Invalid or expired session'
    })
  }
}
