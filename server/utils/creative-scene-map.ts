import type PocketBase from 'pocketbase'
import type { CreativeScene, CreativeSceneListItem } from '~/types/creative-scene'

export const CREATIVE_SCENE_HEADING_MAX = 2000
export const CREATIVE_SCENE_SUMMARY_MAX = 5000
export const CREATIVE_SCENE_BODY_MAX = 150_000

type PbSceneRecord = {
  id: string
  owned_by?: string | { id?: string }
  owner?: string | { id?: string }
  user?: string | { id?: string }
  project?: string | { id?: string }
  sort_order?: number
  sortOrder?: number
  heading?: string
  summary?: string
  body?: string
  created?: string
  updated?: string
}

function relId (v: string | { id?: string } | undefined): string {
  if (!v) return ''
  return typeof v === 'string' ? v : (v.id || '')
}

export function projectIdOnSceneRow (raw: Record<string, unknown>): string {
  return relId(raw.project as string | { id?: string } | undefined)
}

export function pbRecordToCreativeScene (r: PbSceneRecord): CreativeScene {
  return {
    id: r.id,
    ownerId: relId(r.owned_by || r.owner || r.user),
    projectId: relId(r.project),
    sortOrder:
      typeof r.sort_order === 'number'
        ? r.sort_order
        : typeof r.sortOrder === 'number'
          ? r.sortOrder
          : 0,
    heading: String(r.heading || ''),
    summary: String(r.summary || ''),
    body: String(r.body || ''),
    created: String(r.created || ''),
    updated: String(r.updated || '')
  }
}

export function creativeSceneToListItem (
  scene: CreativeScene,
  opts?: { shotCount?: number }
): CreativeSceneListItem {
  return {
    id: scene.id,
    sortOrder: scene.sortOrder,
    heading: scene.heading,
    summary: scene.summary,
    bodyLength: scene.body.length,
    ...(typeof opts?.shotCount === 'number' ? { shotCount: opts.shotCount } : {})
  }
}

export function normalizeCreativeSceneForPb (
  index: number,
  row: {
    heading?: string
    title?: string
    summary?: string
    description?: string
    body?: string
  }
): { heading: string; summary: string; body: string } {
  const headingRaw =
    typeof row.heading === 'string'
      ? row.heading
      : typeof row.title === 'string'
        ? row.title
        : ''
  let heading = headingRaw.trim().slice(0, CREATIVE_SCENE_HEADING_MAX)
  if (!heading) heading = `Scene ${index + 1}`

  const summaryRaw =
    typeof row.summary === 'string'
      ? row.summary
      : typeof row.description === 'string'
        ? row.description
        : ''
  let summary = summaryRaw.trim().slice(0, CREATIVE_SCENE_SUMMARY_MAX)
  if (!summary) summary = heading.slice(0, Math.min(500, heading.length))

  const bodyRaw = typeof row.body === 'string' ? row.body : summaryRaw
  let body = bodyRaw.trim().slice(0, CREATIVE_SCENE_BODY_MAX)
  if (!body) body = summary.slice(0, CREATIVE_SCENE_BODY_MAX)

  return { heading, summary, body }
}

export async function nextCreativeSceneSortOrder (pb: PocketBase, projectId: string): Promise<number> {
  const top = await pb.collection('creative_scenes').getFullList({
    filter: `project="${projectId}"`,
    sort: '-sort_order',
    batch: 1
  })
  if (!top.length) return 1
  const prev = Number(top[0]?.sort_order)
  const base = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0
  return base + 1
}
