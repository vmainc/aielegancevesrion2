import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

export const PB_ID = /^[a-z0-9]{15}$/

export const ACTIONS_MENU_PANEL_CLASS =
  'absolute right-0 bottom-full mb-2 z-50 min-w-[13rem] max-w-[calc(100vw-2rem)] max-h-[min(70vh,20rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg p-1'

export const PROJECT_GROUP_CARD_CLASS =
  'mb-4 rounded-xl border border-gray-200 bg-white group overflow-visible'

export type AssetProjectGroup = {
  key: string
  projectId: string
  title: string
  subtitle: string
  items: ProjectAsset[]
}

export function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function characterMetaFromAsset (a: ProjectAsset): { id: string; name: string } {
  const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
  const id = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
  const name = typeof meta.character_name === 'string' ? meta.character_name.trim() : ''
  if (name) return { id, name }
  const baseTitle = (a.title || '').split('—')[0]?.trim() || ''
  return { id, name: baseTitle }
}

export function isFeaturedCharacterAsset (a: ProjectAsset): boolean {
  const meta = a.metadata
  return !!(meta && typeof meta === 'object' && meta.featured === true)
}

function characterAssetRank (a: ProjectAsset): number {
  let score = 0
  if (a.fileUrl) score += 1_000_000
  if (isFeaturedCharacterAsset(a)) score += 500_000
  const ts = (a.updated || a.created || '').trim()
  for (let i = 0; i < ts.length; i++) score += ts.charCodeAt(i)
  return score
}

function characterDedupeKey (a: ProjectAsset): string {
  const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
  const projectPrefix = pid ? `p:${pid}:` : 'p:__none__:'
  const m = characterMetaFromAsset(a)
  if (m.id && PB_ID.test(m.id)) return `${projectPrefix}id:${m.id}`
  const n = normalizeName(m.name)
  if (n) return `${projectPrefix}name:${n}`
  return `${projectPrefix}asset:${a.id}`
}

export function dedupeCharacterAssets (list: ProjectAsset[]): ProjectAsset[] {
  const best = new Map<string, ProjectAsset>()
  for (const a of list) {
    const k = characterDedupeKey(a)
    const prev = best.get(k)
    if (!prev) {
      best.set(k, a)
      continue
    }
    if (characterAssetRank(a) > characterAssetRank(prev)) best.set(k, a)
  }
  return [...best.values()]
}

export function sortCharacterAssetsForDisplay (list: ProjectAsset[]): ProjectAsset[] {
  return [...list].sort((a, b) => {
    const af = isFeaturedCharacterAsset(a) ? 1 : 0
    const bf = isFeaturedCharacterAsset(b) ? 1 : 0
    if (bf !== af) return bf - af
    const ta = a.updated || a.created || ''
    const tb = b.updated || b.created || ''
    return tb.localeCompare(ta)
  })
}

export function buildProjectAssetGroups (
  list: ProjectAsset[],
  projects: CreativeProject[],
  sortItems: (rows: ProjectAsset[]) => ProjectAsset[]
): AssetProjectGroup[] {
  const byPid = new Map<string, ProjectAsset[]>()
  for (const a of list) {
    const pid = (a.projectId && PB_ID.test(a.projectId)) ? a.projectId : ''
    const key = pid || '__unassigned__'
    const cur = byPid.get(key) || []
    cur.push(a)
    byPid.set(key, cur)
  }
  const groups: AssetProjectGroup[] = []
  for (const [key, raw] of byPid.entries()) {
    const pid = key === '__unassigned__' ? '' : key
    const nameFromAsset = raw.find(a => a.projectName)?.projectName?.trim() || ''
    const nameFromStore =
      pid ? (projects.find(p => p.id === pid)?.name || '').trim() : ''
    const projectName = nameFromAsset || nameFromStore || (pid ? 'Project' : '')
    const title = pid ? projectName || 'Project' : 'No project assigned'
    const subtitle = pid ? `Project id: ${pid}` : 'These entries are not linked to a PocketBase project id.'
    groups.push({
      key,
      projectId: pid,
      title,
      subtitle,
      items: sortItems(raw)
    })
  }
  groups.sort((a, b) => {
    if (!a.projectId && b.projectId) return 1
    if (!b.projectId && a.projectId) return -1
    return a.title.localeCompare(b.title)
  })
  return groups
}

export function isStoredProjectAsset (a: ProjectAsset): boolean {
  return PB_ID.test(a.id) && !a.id.startsWith('charrow_')
}

export function scriptNeedsFullImport (kind: ProjectAssetKind, a: ProjectAsset): boolean {
  if (kind !== 'script') return false
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return false
  const source = typeof meta.source === 'string' ? meta.source : ''
  if (source !== 'script_import') return false
  const status = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''
  return status === 'pending' || status === ''
}

export function scriptSourceLine (kind: ProjectAssetKind, a: ProjectAsset): string {
  if (kind !== 'script') return ''
  const meta = a.metadata
  if (!meta || typeof meta !== 'object') return ''
  const source = typeof meta.source === 'string' ? meta.source : ''
  const analysisStatus = typeof meta.analysis_status === 'string' ? meta.analysis_status : ''

  if (source === 'script_import') {
    if (analysisStatus === 'pending') {
      return 'Saved from a project · run director analysis on Overview when ready'
    }
    if (analysisStatus === 'director_ready') {
      return 'Director analysis done · generate scenes on Scenes, cast on Characters, panels on Storyboard'
    }
    if (analysisStatus === 'complete') {
      return 'Saved from a project · scene breakdown saved (full workflow)'
    }
    return 'Saved from a project'
  }
  if (source === 'script_wizard_upload') {
    return 'Script Wizard'
  }
  return ''
}
