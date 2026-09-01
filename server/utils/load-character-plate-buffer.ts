import { createError } from 'h3'
import { characterPlateRank } from '~/lib/character-turnaround-views'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'

/**
 * Load the best lookbook plate bytes for a cast member (featured/front preferred).
 */
export async function loadCharacterLookbookPlateBuffer (
  projectId: string,
  characterId: string
): Promise<{ data: Buffer; mime: string } | null> {
  const pid = projectId.trim()
  const cid = characterId.trim()
  if (!pid || !cid) return null

  const pb = await getAuthenticatedPocketBase()
  let rows: Array<Record<string, unknown>>
  try {
    rows = (await pb.collection('project_assets').getFullList({
      filter: `project="${pid}" && kind="character"`,
      batch: 200
    })) as Array<Record<string, unknown>>
  } catch {
    return null
  }

  type Ranked = {
    record: Record<string, unknown>
    file: string
    rank: number
    featured: boolean
    ts: string
  }
  const ranked: Ranked[] = []
  for (const record of rows) {
    const meta =
      record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {}
    const metaCid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    if (metaCid !== cid) continue
    const file = typeof record.file === 'string' ? record.file : ''
    if (!file) continue
    ranked.push({
      record,
      file,
      rank: characterPlateRank(meta),
      featured: meta.featured === true,
      ts: String(record.updated || record.created || '')
    })
  }
  if (!ranked.length) return null

  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return (b.ts || '').localeCompare(a.ts || '')
  })
  const best = ranked[0]!

  let fileUrl: string
  try {
    fileUrl = pb.files.getURL(best.record as never, best.file)
  } catch {
    return null
  }
  const adminToken = pb.authStore?.token?.trim()
  const res = await fetch(fileUrl, {
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
  })
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: 'Could not read the character lookbook plate from storage.'
    })
  }
  const data = Buffer.from(await res.arrayBuffer())
  const ctype = (res.headers.get('content-type') || '').split(';')[0]?.trim() || 'image/jpeg'
  return { data, mime: ctype.startsWith('image/') ? ctype : 'image/jpeg' }
}
