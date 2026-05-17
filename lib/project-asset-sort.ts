import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'

/** Workflow order: script → cast → boards → video. */
export const PROJECT_ASSET_KIND_ORDER: Record<ProjectAssetKind, number> = {
  script: 0,
  character: 1,
  storyboard: 2,
  video: 3,
  other: 4
}

function kindRank (kind: ProjectAssetKind): number {
  return PROJECT_ASSET_KIND_ORDER[kind] ?? 99
}

function projectSortKey (a: ProjectAsset): string {
  const name = (a.projectName || '').trim().toLowerCase()
  if (name) return name
  const pid = (a.projectId || '').trim()
  return pid || '\uffff'
}

/** Sort: project name (unassigned last), then asset kind, then title, then newest. */
export function compareProjectAssetsByProjectThenKind (a: ProjectAsset, b: ProjectAsset): number {
  const pk = projectSortKey(a).localeCompare(projectSortKey(b))
  if (pk !== 0) {
    const aUnassigned = !a.projectId
    const bUnassigned = !b.projectId
    if (aUnassigned && !bUnassigned) return 1
    if (bUnassigned && !aUnassigned) return -1
    return pk
  }

  const pidCmp = (a.projectId || '').localeCompare(b.projectId || '')
  if (pidCmp !== 0) return pidCmp

  const kk = kindRank(a.kind) - kindRank(b.kind)
  if (kk !== 0) return kk

  const titleCmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
  if (titleCmp !== 0) return titleCmp

  return String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
}

export function sortProjectAssetsByProjectThenKind (items: ProjectAsset[]): ProjectAsset[] {
  return [...items].sort(compareProjectAssetsByProjectThenKind)
}

export function sortProjectAssetsWithinProjectByKind (items: ProjectAsset[]): ProjectAsset[] {
  return [...items].sort((a, b) => {
    const kk = kindRank(a.kind) - kindRank(b.kind)
    if (kk !== 0) return kk
    const titleCmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
    if (titleCmp !== 0) return titleCmp
    return String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || ''))
  })
}

export type ProjectAssetGroup = {
  key: string
  projectId: string
  projectName: string
  items: ProjectAsset[]
}

export function groupProjectAssetsByProject (
  items: ProjectAsset[],
  sortWithinProject: (rows: ProjectAsset[]) => ProjectAsset[] = sortProjectAssetsWithinProjectByKind
): ProjectAssetGroup[] {
  const byPid = new Map<string, ProjectAsset[]>()
  for (const a of items) {
    const pid = a.projectId?.trim() || ''
    const key = pid || '__unassigned__'
    const cur = byPid.get(key) || []
    cur.push(a)
    byPid.set(key, cur)
  }

  const groups: ProjectAssetGroup[] = []
  for (const [key, raw] of byPid.entries()) {
    const projectId = key === '__unassigned__' ? '' : key
    const projectName =
      raw.find(x => x.projectName?.trim())?.projectName?.trim() ||
      (projectId ? 'Project' : 'No project assigned')
    groups.push({
      key,
      projectId,
      projectName,
      items: sortWithinProject(raw)
    })
  }

  groups.sort((a, b) => {
    if (!a.projectId && b.projectId) return 1
    if (!b.projectId && a.projectId) return -1
    return a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' })
  })

  return groups
}
