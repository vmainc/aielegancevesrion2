import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

function clampPct (v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!projectId || !characterId) {
    throw createError({ statusCode: 400, message: 'Missing project or character id' })
  }

  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('creative_characters').getOne(characterId)
  const row = existing as Record<string, unknown>
  if (projectIdOnCharacterRow(row) !== projectId) {
    throw createError({ statusCode: 403, message: 'Character does not belong to this project' })
  }

  const body = await readBody<{
    name?: string
    roleDescription?: string
    screenSharePercent?: number | null
    voiceDescription?: string
    appearanceDescription?: string
    personality?: string
    signatureDetails?: string
    avoidDescription?: string
  }>(event).catch(() => ({}))

  const patch: Record<string, unknown> = {}

  if (body && typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 200)
    if (!name) {
      throw createError({ statusCode: 400, message: 'Name cannot be empty' })
    }
    patch.name = name
  }

  if (body && typeof body.roleDescription === 'string') {
    patch.role_description = body.roleDescription.trim().slice(0, 10000)
  }

  if (body && 'screenSharePercent' in body) {
    const p = clampPct(body.screenSharePercent)
    if (p === null) {
      patch.screen_share_percent = null
    } else if (p !== undefined) {
      patch.screen_share_percent = p
    }
  }

  if (body && typeof body.voiceDescription === 'string') {
    patch.voice_description = body.voiceDescription.trim().slice(0, 2000)
  }

  if (body && typeof body.appearanceDescription === 'string') {
    patch.appearance_description = body.appearanceDescription.trim().slice(0, 4000)
  }

  if (body && typeof body.personality === 'string') {
    patch.personality = body.personality.trim().slice(0, 4000)
  }

  if (body && typeof body.signatureDetails === 'string') {
    patch.signature_details = body.signatureDetails.trim().slice(0, 2000)
  }

  if (body && typeof body.avoidDescription === 'string') {
    patch.avoid_description = body.avoidDescription.trim().slice(0, 2000)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const updated = await pb.collection('creative_characters').update(characterId, patch)
    const character = pbRecordToCreativeCharacter(updated as Record<string, unknown>)
    await syncProjectToBibleSafe({
      pb,
      userId: access.ownerId,
      projectId,
      scopes: ['characters'],
      characterIds: [character.id]
    })
    return { character }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update character'
    })
  }
})
