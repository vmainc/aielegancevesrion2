import { createError } from 'h3'

/**
 * Asset `fileUrl` values are often rewritten to Nitro's `/pb` proxy (`/pb/api/files/...`)
 * so the browser stays same-origin. Node `fetch` cannot use relative URLs — resolve to an
 * absolute PocketBase files URL (prefer loopback internal base on the VPS).
 */
export function resolvePocketBaseProxiedUrlForServerFetch (
  url: string,
  opts: { pocketbaseInternalUrl: string; publicPocketbaseUrl?: string }
): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u

  const int = opts.pocketbaseInternalUrl.replace(/\/+$/, '')
  const pub = (opts.publicPocketbaseUrl || '').replace(/\/+$/, '')

  let path = ''
  if (u.startsWith('/pb/')) path = u.slice('/pb'.length)
  else if (u === '/pb') path = '/'
  else if (u.startsWith('/api/files/')) path = u

  if (!path.startsWith('/api/files/')) {
    throw createError({
      statusCode: 400,
      message: `Cannot fetch frame image: need an absolute URL or a PocketBase file path under /pb or /api/files (got: ${u.slice(0, 160)})`
    })
  }

  if (int) return `${int}${path}`
  if (pub) return `${pub}${path}`

  throw createError({
    statusCode: 500,
    message: 'Cannot resolve storyboard image URL: set POCKETBASE_INTERNAL_URL (or NUXT_PUBLIC_POCKETBASE_URL) on the server.'
  })
}
