import type PocketBase from 'pocketbase'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'

const KINDS: ProjectAssetKind[] = ['script', 'character', 'storyboard', 'video', 'other']

function parseKind (v: unknown): ProjectAssetKind {
  if (typeof v === 'string' && KINDS.includes(v as ProjectAssetKind)) {
    return v as ProjectAssetKind
  }
  return 'other'
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
      fileUrl = pb.files.getUrl(record as never, file)
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

  return {
    id: String(record.id ?? ''),
    projectId,
    projectName,
    kind: parseKind(record.kind),
    title: typeof record.title === 'string' ? record.title : '',
    notes: typeof record.notes === 'string' ? record.notes : '',
    metadata,
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : 0,
    fileUrl,
    created: typeof record.created === 'string' ? record.created : '',
    updated: typeof record.updated === 'string' ? record.updated : ''
  }
}
