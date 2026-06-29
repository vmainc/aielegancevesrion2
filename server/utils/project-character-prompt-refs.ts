import type { CastMemberForContinuity } from '~/lib/storyboard-continuity-prompts'
import type PocketBase from 'pocketbase'

type PortraitMeta = {
  notes: string
  promptUsed: string
  featured: boolean
  ts: string
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function portraitMetaByCharacter (
  characters: Array<{ id: string; name: string; role_description?: string }>,
  assets: Array<Record<string, unknown>>
): Map<string, { notes: string; promptUsed: string }> {
  const byId: Record<string, PortraitMeta> = {}
  const byName: Record<string, PortraitMeta> = {}

  for (const a of assets) {
    const meta = (a.metadata && typeof a.metadata === 'object' ? a.metadata : {}) as Record<
      string,
      unknown
    >
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname =
      typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const featured = meta.featured === true
    const notes = typeof a.notes === 'string' ? a.notes.trim() : ''
    const promptUsed =
      typeof meta.prompt_used === 'string'
        ? meta.prompt_used.trim()
        : typeof meta.promptUsed === 'string'
          ? meta.promptUsed.trim()
          : ''
    const ts = String(a.updated || a.created || '')
    if (!notes && !promptUsed) continue

    const patch = (bucket: Record<string, PortraitMeta>, key: string) => {
      const prev = bucket[key]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        bucket[key] = { notes, promptUsed, featured, ts }
      }
    }
    if (cid) patch(byId, cid)
    if (cname) patch(byName, cname)
  }

  const out = new Map<string, { notes: string; promptUsed: string }>()
  for (const c of characters) {
    const hit = byId[c.id] || byName[normalizeName(c.name)]
    if (hit) {
      out.set(c.id, { notes: hit.notes, promptUsed: hit.promptUsed })
    }
  }
  return out
}

/** Cast rows enriched with featured portrait notes for production prompts. */
export async function loadCastMembersForContinuity (
  pb: PocketBase,
  projectId: string
): Promise<CastMemberForContinuity[]> {
  const charRows = await pb.collection('creative_characters').getFullList({
    filter: `project="${projectId}"`,
    batch: 200
  })
  const characters = charRows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      name: String(row.name || ''),
      role_description: String(row.role_description || ''),
      appearance_description: String(row.appearance_description || ''),
      signature_details: String(row.signature_details || ''),
      avoid_description: String(row.avoid_description || '')
    }
  })

  let assets: Array<Record<string, unknown>> = []
  try {
    assets = (await pb.collection('project_assets').getFullList({
      filter: `project="${projectId}" && kind="character"`,
      batch: 200
    })) as Array<Record<string, unknown>>
  } catch {
    assets = []
  }

  const portraitMeta = portraitMetaByCharacter(characters, assets)

  return characters.map(c => {
    const extra = portraitMeta.get(c.id)
    return {
      name: c.name,
      traitsRoleVisual: c.role_description,
      appearanceDescription: c.appearance_description || undefined,
      signatureDetails: c.signature_details || undefined,
      avoidDescription: c.avoid_description || undefined,
      portraitNotes: extra?.notes,
      portraitPromptUsed: extra?.promptUsed
    }
  })
}
