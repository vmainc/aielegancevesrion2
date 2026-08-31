import { createError } from 'h3'
import {
  isAllowedRepairVideoFilename,
  isAllowedRepairVideoMime,
  mimeFromRepairFilename
} from '~/lib/video-repair/limits'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { fetchBinaryFromUrlForIngest } from '~/server/utils/fetch-url-for-project-ingest'
import { getVideoRepairMaxBytes } from '~/server/utils/video-repair-config'
import {
  newVideoRepairMediaId,
  readVideoRepairMedia,
  saveVideoRepairMedia
} from '~/server/utils/video-repair-media-store'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

function bufferToDataUri (data: Buffer, mime: string): string {
  return `data:${mime};base64,${data.toString('base64')}`
}

export async function stageBufferAsRepairMedia (
  data: Buffer,
  mime: string
): Promise<{ mediaId: string; mime: string; bytes: number }> {
  const id = newVideoRepairMediaId()
  const saved = await saveVideoRepairMedia({ id, data, mime })
  return { mediaId: id, mime: saved.mime, bytes: saved.bytes }
}

export async function loadProjectAssetVideoBuffer (
  projectId: string,
  assetId: string
): Promise<{ data: Buffer; mime: string; filename: string }> {
  const pb = await getAuthenticatedPocketBase()
  let record: Record<string, unknown>
  try {
    record = (await pb.collection('project_assets').getOne(assetId)) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Source video not found in the library.' })
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
  if (rowProjectId !== projectId) {
    throw createError({ statusCode: 403, message: 'That clip does not belong to this project.' })
  }
  if (String(record.kind || '') !== 'video') {
    throw createError({ statusCode: 400, message: 'Source must be a video asset.' })
  }
  const file = record.file
  if (typeof file !== 'string' || !file.length) {
    throw createError({ statusCode: 404, message: 'That clip has no file attached.' })
  }
  let fileUrl: string
  try {
    fileUrl = pb.files.getURL(record as never, file)
  } catch {
    throw createError({ statusCode: 404, message: 'Could not resolve the source video file.' })
  }
  const adminToken = pb.authStore?.token?.trim()
  const res = await fetch(fileUrl, {
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, message: 'Could not read the source video from storage.' })
  }
  const data = Buffer.from(await res.arrayBuffer())
  const max = getVideoRepairMaxBytes()
  if (data.length > max) {
    throw createError({
      statusCode: 413,
      message: `Source video is too large (max ${Math.round(max / 1_048_576)}MB).`
    })
  }
  const mime =
    (res.headers.get('content-type') || '').split(';')[0]?.trim() ||
    mimeFromRepairFilename(file)
  return { data, mime, filename: file }
}

export async function stageRemoteVideoUrl (url: string): Promise<{ mediaId: string; mime: string }> {
  const config = useRuntimeConfig()
  const fetched = await fetchBinaryFromUrlForIngest(url, {
    openRouterApiKey: resolveOpenRouterApiKey(config),
    maxBytes: getVideoRepairMaxBytes(),
    timeoutMs: 180_000,
    mediaKind: 'video'
  })
  const mime = fetched.contentType.split(';')[0]?.trim() || 'video/mp4'
  if (!isAllowedRepairVideoMime(mime) && !isAllowedRepairVideoFilename(fetched.suggestedName)) {
    throw createError({ statusCode: 400, message: 'Unsupported video type. Use MP4, MOV, or WebM.' })
  }
  const staged = await stageBufferAsRepairMedia(fetched.buffer, mime)
  return { mediaId: staged.mediaId, mime: staged.mime }
}

/**
 * OpenRouter Aleph only accepts HTTPS video URLs (not data: URIs).
 * The public token URL must already be persisted before the provider fetches it.
 */
export async function sourceUrlForOpenRouter (opts: {
  publicUrl: string | null
  mediaId?: string
}): Promise<string> {
  const pub = (opts.publicUrl || '').trim()
  if (/^https:\/\//i.test(pub)) return pub
  if (/^http:\/\//i.test(pub)) return `https://${pub.slice('http://'.length)}`

  // Confirm media exists so the error is about reachability, not a missing upload.
  if (opts.mediaId) {
    const staged = await readVideoRepairMedia(opts.mediaId)
    if (!staged) {
      throw createError({ statusCode: 404, message: 'Source video expired. Upload it again.' })
    }
  }
  throw createError({
    statusCode: 400,
    message:
      'OpenRouter Aleph needs a public HTTPS source URL. Set VIDEO_REPAIR_PUBLIC_BASE_URL=https://aifilmstud.io in the server .env (data URIs are not allowed).'
  })
}

export async function imageDataUriFromMedia (mediaId: string): Promise<string> {
  const staged = await readVideoRepairMedia(mediaId)
  if (!staged) {
    throw createError({ statusCode: 404, message: 'Reference frame expired. Extract or upload it again.' })
  }
  if (staged.data.length > 6_000_000) {
    throw createError({ statusCode: 400, message: 'Reference image is too large.' })
  }
  return bufferToDataUri(staged.data, staged.mime)
}
