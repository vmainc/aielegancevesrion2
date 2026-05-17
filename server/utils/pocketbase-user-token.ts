import { createError, getHeader, getQuery, type H3Event } from 'h3'
import { resolvePocketBaseAdmin } from '~/server/utils/server-env'

export type PocketBaseUserFromRequestOpts = {
  /**
   * Also accept `?access_token=` (GET only). Used for `<video src>` / `<audio src>`
   * where the browser cannot attach `Authorization`.
   */
  allowAccessTokenQuery?: boolean
}

function extractUserJwtFromEvent (event: H3Event, opts?: PocketBaseUserFromRequestOpts): string {
  const raw = getHeader(event, 'authorization') || getHeader(event, 'Authorization') || ''
  const m = raw.match(/^Bearer\s+(.+)$/i)
  const fromHeader = m?.[1]?.trim()
  if (fromHeader) return fromHeader

  if (opts?.allowAccessTokenQuery && event.method === 'GET') {
    const q = getQuery(event) as { access_token?: unknown }
    if (typeof q.access_token === 'string' && q.access_token.trim()) {
      return q.access_token.trim()
    }
  }

  const msg =
    opts?.allowAccessTokenQuery && event.method === 'GET'
      ? 'Missing Authorization Bearer token or access_token query parameter'
      : 'Missing Authorization Bearer token'
  throw createError({ statusCode: 401, message: msg })
}

/**
 * Resolve PocketBase user id from `Authorization: Bearer <users_token>`
 * (or `?access_token=` when opts.allowAccessTokenQuery and method is GET).
 */
export async function getPocketBaseUserIdFromRequest (
  event: H3Event,
  opts?: PocketBaseUserFromRequestOpts
): Promise<string> {
  const token = extractUserJwtFromEvent(event, opts)

  const config = useRuntimeConfig()
  const admin = resolvePocketBaseAdmin(config)
  const base =
    admin.internalUrl ||
    String(config.pocketbaseInternalUrl || '').replace(/\/+$/, '') ||
    String(config.public.pocketbaseUrl || '').replace(/\/+$/, '')

  if (!base) {
    throw createError({ statusCode: 500, message: 'PocketBase URL not configured' })
  }

  const unreachableMessage = `Cannot reach PocketBase at ${base}. Start PocketBase (e.g. \`./pocketbase/pocketbase serve\`) or set NUXT_POCKETBASE_INTERNAL_URL / POCKETBASE_INTERNAL_URL to its HTTP URL (usually http://127.0.0.1:8090). The Nuxt app can use a /pb proxy in the browser, but API routes must reach PocketBase directly.`

  try {
    const res = await fetch(`${base}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      const t = await res.text()
      const trimmed = t.trimStart()
      if (trimmed.startsWith('<')) {
        throw createError({
          statusCode: 502,
          message:
            `PocketBase at ${base} returned HTML (${res.status}). Server routes cannot use a browser-only /pb URL — set POCKETBASE_INTERNAL_URL to the real PocketBase HTTP URL (e.g. http://127.0.0.1:8090 on the machine running PB).`
        })
      }
      throw new Error(t || res.statusText)
    }
    const data = (await res.json()) as { record?: { id?: string } }
    const id = data.record?.id
    if (!id) {
      throw new Error('No user id in auth response')
    }
    return id
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'statusCode' in e) {
      throw e
    }
    const msg = e instanceof Error ? e.message : String(e)
    if (isNodeFetchUnreachableError(msg)) {
      throw createError({ statusCode: 503, message: unreachableMessage })
    }
    throw createError({
      statusCode: 401,
      message: msg || 'Invalid or expired session'
    })
  }
}

function isNodeFetchUnreachableError (msg: string): boolean {
  return /fetch failed|failed to fetch|econnrefused|econnreset|enotfound|network|socket|connect/i.test(msg)
}
