import { createError } from 'h3'
import { parseProjectAssetMediaIds } from '~/lib/project-asset-playback-url'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

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
  else if (u.startsWith('/api/files/')) path = u.split('?')[0] || u

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

async function resolveProjectAssetMediaToFileUrl (
  url: string,
  opts: { pocketbaseInternalUrl: string; publicPocketbaseUrl?: string }
): Promise<string> {
  const ids = parseProjectAssetMediaIds(url)
  if (!ids) {
    throw createError({
      statusCode: 400,
      message: 'Invalid project asset media URL'
    })
  }

  const pb = await getAuthenticatedPocketBase()
  let record: Record<string, unknown>
  try {
    record = (await pb.collection('project_assets').getOne(ids.assetId)) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Reference portrait asset not found' })
    }
    throw e
  }

  const recProject = record.project
  const rowProjectId =
    typeof recProject === 'string'
      ? recProject
      : recProject && typeof recProject === 'object' && 'id' in recProject
        ? String((recProject as { id: string }).id)
        : ''
  if (rowProjectId !== ids.projectId) {
    throw createError({ statusCode: 403, message: 'Reference portrait does not belong to this project' })
  }

  const file = record.file
  if (typeof file !== 'string' || !file.length) {
    throw createError({ statusCode: 404, message: 'Reference portrait has no file' })
  }

  let fileUrl: string
  try {
    fileUrl = pb.files.getURL(record as never, file)
  } catch {
    throw createError({ statusCode: 404, message: 'Could not resolve reference portrait file URL' })
  }

  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  return resolvePocketBaseProxiedUrlForServerFetch(fileUrl, opts)
}

/**
 * Resolve browser-facing asset URLs for server-side fetch (OpenRouter reference images, etc.).
 */
export async function resolveReferenceImageUrlForServerFetch (
  url: string,
  opts: { pocketbaseInternalUrl: string; publicPocketbaseUrl?: string }
): Promise<string> {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u
  if (parseProjectAssetMediaIds(u)) {
    return resolveProjectAssetMediaToFileUrl(u, opts)
  }
  return resolvePocketBaseProxiedUrlForServerFetch(u, opts)
}
