import { readMultipartFormData, createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { formatPocketBaseRecordError, isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'
import type { ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']
/** Align with PocketBase `project_assets.file` maxSize in setup-collections.js */
const MAX_FILE_BYTES = 52_428_800

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const { pb, access } = await requireProjectOwner(event, projectId)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'Expected multipart form (file + fields)' })
  }

  let fileBuf: Buffer | null = null
  let filename = 'upload.png'
  let kindRaw = ''
  let title = ''
  let notes = ''
  let metadataStr = ''

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length && part.filename) {
      fileBuf = part.data
      filename = part.filename || filename
    }
    if (part.name === 'kind' && part.data) {
      kindRaw = part.data.toString('utf8').trim()
    }
    if (part.name === 'title' && part.data) {
      title = part.data.toString('utf8').trim()
    }
    if (part.name === 'notes' && part.data) {
      notes = part.data.toString('utf8').trim()
    }
    if (part.name === 'metadata' && part.data) {
      metadataStr = part.data.toString('utf8').trim()
    }
  }

  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing file' })
  }
  if (fileBuf.length > MAX_FILE_BYTES) {
    throw createError({
      statusCode: 413,
      message: `Image or file is too large (max ${Math.round(MAX_FILE_BYTES / 1_048_576)}MB). Use a smaller image or re-export at lower resolution.`
    })
  }

  const kind =
    typeof kindRaw === 'string' && KINDS.includes(kindRaw as ProjectAssetKind)
      ? (kindRaw as ProjectAssetKind)
      : null
  if (!kind) {
    throw createError({
      statusCode: 400,
      message: `kind is required (${KINDS.join(', ')})`
    })
  }

  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  let metadata: Record<string, unknown> | null = null
  if (metadataStr) {
    try {
      const parsed = JSON.parse(metadataStr) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>
      }
    } catch {
      throw createError({ statusCode: 400, message: 'metadata must be valid JSON' })
    }
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'upload.png'

  const formData = new FormData()
  formData.append('owned_by', access.ownerId)
  formData.append('project', projectId)
  formData.append('kind', kind)
  formData.append('title', title.slice(0, 500))
  formData.append('notes', notes.slice(0, 20_000))
  // Some legacy PB number validators treat 0 as blank on required fields.
  formData.append('sort_order', '1')
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata))
  }
  const uint8 = fileBuf instanceof Uint8Array ? fileBuf : new Uint8Array(fileBuf)
  const blob = new Blob([uint8])
  formData.append('file', blob, safeFilename)

  try {
    const created = await pb.collection('project_assets').create(formData)
    await syncProjectToBibleSafe({
      pb,
      userId: access.ownerId,
      projectId,
      scopes: ['assets', 'characters']
    })
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
