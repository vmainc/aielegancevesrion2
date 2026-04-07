import type PocketBase from 'pocketbase'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export const SCRIPT_LIBRARY_PROJECT_NAME = 'Script library'

/**
 * Pocket project used when `project_assets.project` is required but the asset is not tied to a user-chosen project (e.g. Script Wizard library uploads).
 */
export async function getOrCreateScriptLibraryProjectId (
  pb: PocketBase,
  userId: string
): Promise<string> {
  try {
    const rows = await pb.collection('creative_projects').getFullList({
      filter: `owned_by = "${userId}" && name = "Script library"`,
      batch: 5
    })
    if (rows.length) return rows[0]!.id
  } catch {
    const all = await pb.collection('creative_projects').getFullList({ batch: 300 })
    const hit = all.find(
      r =>
        pbRecordOwnerId(r as Record<string, unknown>) === userId &&
        String((r as { name?: string }).name) === SCRIPT_LIBRARY_PROJECT_NAME
    )
    if (hit) return hit.id
  }

  const created = await pb.collection('creative_projects').create({
    name: SCRIPT_LIBRARY_PROJECT_NAME,
    owned_by: userId,
    aspect_ratio: '16:9',
    goal: 'film',
    target_length: 'short',
    synopsis: '',
    treatment: '',
    concept_notes: ''
  })
  return created.id
}
