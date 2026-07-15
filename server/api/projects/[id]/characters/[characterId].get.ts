import { createError, getQuery, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type { ProjectAsset } from '~/types/project-asset'
import type { CreativeCharacter } from '~/types/creative-project'

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function assetMetaRecord (a: ProjectAsset): Record<string, unknown> {
  return (a.metadata && typeof a.metadata === 'object') ? a.metadata as Record<string, unknown> : {}
}

function assetCharacterId (a: ProjectAsset): string {
  const v = assetMetaRecord(a).character_id
  return typeof v === 'string' ? v.trim() : ''
}

function assetCharacterName (a: ProjectAsset): string {
  const meta = assetMetaRecord(a)
  const cn = typeof meta.character_name === 'string' ? meta.character_name.trim() : ''
  if (cn) return cn
  return String(a.title || '').split('—')[0]?.trim() || ''
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!projectId || !characterId) {
    throw createError({ statusCode: 400, message: 'Missing project or character id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId)

  // Self-heal: image/voice assets can keep a stale `character_id` after a
  // character row is deleted and recreated. When the id misses (or points at
  // another project), fall back to matching by name within this project so the
  // profile link keeps working instead of hard-404ing.
  const query = getQuery(event)
  const hintedName = typeof query.name === 'string' ? normalizeName(query.name) : ''

  async function findByName (): Promise<Record<string, unknown> | null> {
    if (!hintedName) return null
    try {
      const list = await pb.collection('creative_characters').getList(1, 200, {
        filter: `project = "${projectId}"`
      })
      for (const item of list.items as Array<Record<string, unknown>>) {
        if (normalizeName(String(item.name || '')) === hintedName) return item
      }
    } catch {
      /* fall through to not-found */
    }
    return null
  }

  let row: Record<string, unknown> | null = null
  try {
    row = (await pb.collection('creative_characters').getOne(characterId)) as Record<string, unknown>
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) !== 404) throw e
    row = null
  }

  // Wrong project / missing → try the name fallback before giving up.
  if (!row || projectIdOnCharacterRow(row) !== projectId) {
    row = await findByName()
  }
  if (row && projectIdOnCharacterRow(row) !== projectId) {
    throw createError({ statusCode: 403, message: 'Character does not belong to this project' })
  }

  // Load all character assets for this project up front so we can both match
  // this character's media AND synthesize a profile when no creative_characters
  // row exists (e.g. the row was deleted but its uploaded images/voice remain).
  let allAssets: ProjectAsset[] = []
  try {
    const rows = await listProjectAssetsForProject(pb, projectId, userId, { kind: 'character' })
    for (const r of rows) {
      try {
        allAssets.push(pbRecordToProjectAsset(r as Record<string, unknown>, pb))
      } catch {
        /* skip unreadable row */
      }
    }
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) {
      console.warn('[character detail] assets list failed:', formatPocketBaseRecordError(e))
    }
    allAssets = []
  }

  const resolvedId = row ? String(row.id) : ''
  const resolvedName = row ? normalizeName(String(row.name || '')) : ''
  const wantName = resolvedName || hintedName

  const matchesCharacter = (a: ProjectAsset): boolean => {
    const cid = assetCharacterId(a)
    if (cid) return cid === characterId || (Boolean(resolvedId) && cid === resolvedId)
    const cname = normalizeName(assetCharacterName(a))
    return Boolean(wantName) && cname === wantName
  }

  const assets = allAssets.filter(matchesCharacter)

  let character: CreativeCharacter
  if (row) {
    character = pbRecordToCreativeCharacter(row)
  } else {
    // No backing record. Synthesize a minimal profile from the linked assets so
    // the page renders instead of hard-404ing. The page creates a real record
    // on first save and re-links these assets to it.
    const fromAsset = assets.map((a) => assetCharacterName(a)).find(Boolean) || ''
    const name = (typeof query.name === 'string' && query.name.trim()) || fromAsset
    if (!name && assets.length === 0) {
      throw createError({ statusCode: 404, message: 'Character not found' })
    }
    character = {
      id: characterId,
      name: name || 'Character',
      roleDescription: '',
      screenSharePercent: null,
      voiceDescription: '',
      appearanceDescription: '',
      personality: '',
      signatureDetails: '',
      avoidDescription: ''
    }
  }

  return { character, assets, synthetic: !row }
})
