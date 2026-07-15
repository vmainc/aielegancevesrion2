import type PocketBase from 'pocketbase'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']

function parseKind (v: unknown): ProjectAssetKind {
  if (typeof v === 'string' && KINDS.includes(v as ProjectAssetKind)) {
    return v as ProjectAssetKind
  }
  return 'other'
}

function toSafeAssetUrl (rawUrl: string): string {
  // Always serve PB files through Nitro's /pb proxy so browser origin stays https-safe.
  // This avoids mixed-content issues when PocketBase internal URL is http://127.0.0.1:8090.
  try {
    const parsed = new URL(rawUrl)
    if (parsed.pathname.startsWith('/api/files/')) {
      return `/pb${parsed.pathname}${parsed.search || ''}`
    }
    return rawUrl
  } catch {
    if (rawUrl.startsWith('/api/files/')) {
      return `/pb${rawUrl}`
    }
    return rawUrl
  }
}

function relationId (raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return String((raw as { id: string }).id)
  }
  return ''
}

export function pbRecordToProjectAsset (
  record: Record<string, unknown>,
  pb: PocketBase
): ProjectAsset {
  const projectRaw = record.project
  const projectId =
    typeof projectRaw === 'string'
      ? projectRaw
      : projectRaw && typeof projectRaw === 'object' && 'id' in projectRaw
        ? String((projectRaw as { id: string }).id)
        : ''

  let fileUrl: string | null = null
  const file = record.file
  if (typeof file === 'string' && file.length) {
    try {
      const raw = pb.files.getURL(record as never, file)
      fileUrl = toSafeAssetUrl(raw)
    } catch {
      fileUrl = null
    }
  }

  let projectName: string | undefined
  const expand = record.expand as { project?: { name?: string } } | undefined
  if (expand?.project?.name) {
    projectName = expand.project.name
  }

  const meta = record.metadata
  let metadata: Record<string, unknown> | null = null
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    metadata = meta as Record<string, unknown>
  } else if (typeof meta === 'string' && meta.trim()) {
    try {
      const parsed = JSON.parse(meta) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>
      }
    } catch {
      metadata = null
    }
  }

  const sceneId =
    relationId(record.scene) ||
    (typeof metadata?.scene_id === 'string' ? metadata.scene_id : '') ||
    undefined
  const shotId =
    relationId(record.shot) ||
    (typeof metadata?.shot_id === 'string' ? metadata.shot_id : '') ||
    undefined
  const characterId =
    relationId(record.character) ||
    (typeof metadata?.character_id === 'string' ? metadata.character_id : '') ||
    undefined

  return {
    id: String(record.id ?? ''),
    projectId,
    projectName,
    kind: parseKind(record.kind),
    title: typeof record.title === 'string' ? record.title : '',
    notes: typeof record.notes === 'string' ? record.notes : '',
    metadata,
    sceneId,
    shotId,
    characterId,
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : 0,
    fileUrl,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : ''
  }
}
