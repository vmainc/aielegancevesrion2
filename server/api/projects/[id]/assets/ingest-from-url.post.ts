import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { fetchBinaryFromUrlForIngest } from '~/server/utils/fetch-url-for-project-ingest'
import {
  parseMusicResultIdFromPath,
  readMusicGenerationResult
} from '~/server/utils/music-generation-store'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import type { ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']
const MAX_FILE_BYTES = 52_428_800

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null

  const sourceUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  const kindRaw = typeof body?.kind === 'string' ? body.kind.trim() : 'video'
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : ''

  if (!sourceUrl) {
    throw createError({ statusCode: 400, message: 'url is required' })
  }
  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  const kind = KINDS.includes(kindRaw as ProjectAssetKind) ? (kindRaw as ProjectAssetKind) : null
  if (!kind) {
    throw createError({ statusCode: 400, message: `kind must be one of: ${KINDS.join(', ')}` })
  }

  let metadata: Record<string, unknown> | null = null
  if (body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
    metadata = body.metadata as Record<string, unknown>
  }

  const pb = await getAuthenticatedPocketBase()
  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const config = useRuntimeConfig()
  const openRouterKey = resolveOpenRouterApiKey(config)

  const musicResultId = parseMusicResultIdFromPath(sourceUrl)
  const metadataSource =
    metadata && typeof metadata.source === 'string' ? metadata.source.trim() : ''
  const isMusicAsset = metadataSource === 'music_generation' || Boolean(musicResultId)

  let buffer: Buffer
  let suggestedName: string

  if (musicResultId) {
    const staged = await readMusicGenerationResult(musicResultId)
    if (!staged) {
      throw createError({ statusCode: 404, message: 'Generated audio not found or expired — generate again.' })
    }
    buffer = staged.data
    suggestedName = `music_${musicResultId.slice(0, 8)}.mp3`
  } else {
    const mediaKind =
      kind === 'storyboard' || kind === 'character'
        ? ('image' as const)
        : isMusicAsset
          ? ('audio' as const)
          : ('video' as const)

    const fetched = await fetchBinaryFromUrlForIngest(sourceUrl, {
      openRouterApiKey: openRouterKey || undefined,
      maxBytes: MAX_FILE_BYTES,
      timeoutMs: 180_000,
      mediaKind
    })
    buffer = fetched.buffer
    suggestedName = fetched.suggestedName
  }

  const safeFilename =
    suggestedName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) ||
    (isMusicAsset ? 'music.mp3' : 'video.mp4')

  const formData = new FormData()
  formData.append('owned_by', userId)
  formData.append('project', projectId)
  formData.append('kind', kind)
  formData.append('title', title.slice(0, 500))
  formData.append('notes', (notes || 'Ingested from URL').slice(0, 20_000))
  formData.append('sort_order', '1')
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata))
  }
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const blob = new Blob([uint8])
  formData.append('file', blob, safeFilename)

  try {
    const created = await pb.collection('project_assets').create(formData)
    return {
      asset: pbRecordToProjectAsset(created as Record<string, unknown>, pb)
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'project_assets collection is missing. Run: node scripts/setup-collections.js (adds project_assets).'
      })
    }
    const status = pocketBaseErrorStatus(e)
    const detail = formatPocketBaseRecordError(e)
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 413) {
      throw createError({ statusCode: status, message: detail || 'Could not save asset' })
    }
    throw createError({
      statusCode: 500,
      message: detail || 'Could not save asset right now. Please try again.'
    })
  }
})
