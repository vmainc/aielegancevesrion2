import { createError, getRequestHeader, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'cache-control',
  'last-modified'
] as const

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const assetId = getRouterParam(event, 'assetId')
  if (!projectId || !assetId) {
    throw createError({ statusCode: 400, message: 'Missing project or asset id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event, { allowAccessTokenQuery: true })
  const pb = await getAuthenticatedPocketBase()

  let record: Record<string, unknown>
  try {
    record = (await pb.collection('project_assets').getOne(assetId)) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 404) {
      throw createError({ statusCode: 404, message: 'Asset not found' })
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
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (pbRecordOwnerId(record) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const file = record.file
  if (typeof file !== 'string' || !file.length) {
    throw createError({ statusCode: 404, message: 'No file on this asset' })
  }

  let fileUrl: string
  try {
    fileUrl = pb.files.getURL(record as never, file)
  } catch {
    throw createError({ statusCode: 404, message: 'Could not resolve file URL' })
  }

  const range = getRequestHeader(event, 'range') || undefined
  const adminToken = pb.authStore?.token?.trim()
  const upstreamHeaders: Record<string, string> = {}
  if (adminToken) {
    upstreamHeaders.Authorization = `Bearer ${adminToken}`
  }
  if (range) {
    upstreamHeaders.Range = range
  }

  const upstream = await fetch(fileUrl, { headers: upstreamHeaders })
  if (!upstream.ok && upstream.status !== 206) {
    if (upstream.status === 404) {
      throw createError({ statusCode: 404, message: 'File not found' })
    }
    const t = await upstream.text().catch(() => '')
    throw createError({
      statusCode: 502,
      message: `Storage returned ${upstream.status}${t ? `: ${t.slice(0, 200)}` : ''}`
    })
  }

  const outHeaders = new Headers()
  for (const k of PASSTHROUGH_HEADERS) {
    const v = upstream.headers.get(k)
    if (v) {
      outHeaders.set(k, v)
    }
  }
  // Allow canvas export (drawImage) when clips are loaded with crossOrigin="anonymous".
  outHeaders.set('Access-Control-Allow-Origin', '*')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  })
})
