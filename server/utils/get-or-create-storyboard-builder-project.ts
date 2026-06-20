import type PocketBase from 'pocketbase'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export const STORYBOARD_BUILDER_PROJECT_NAME = 'Storyboard builder'

/** Pocket project for standalone storyboard scenes built outside the full workflow. */
export async function getOrCreateStoryboardBuilderProjectId (
  pb: PocketBase,
  userId: string
): Promise<string> {
  try {
    const rows = await pb.collection('creative_projects').getFullList({
      filter: `owned_by = "${userId}" && name = "${STORYBOARD_BUILDER_PROJECT_NAME}"`,
      batch: 5
    })
    if (rows.length) return rows[0]!.id
  } catch {
    const all = await pb.collection('creative_projects').getFullList({ batch: 300 })
    const hit = all.find(
      r =>
        pbRecordOwnerId(r as Record<string, unknown>) === userId &&
        String((r as { name?: string }).name) === STORYBOARD_BUILDER_PROJECT_NAME
    )
    if (hit) return hit.id
  }

  const created = await pb.collection('creative_projects').create({
    name: STORYBOARD_BUILDER_PROJECT_NAME,
    owned_by: userId,
    aspect_ratio: '16:9',
    goal: 'film',
    workflow_mode: 'generate',
    target_length: 'short',
    synopsis: '',
    treatment: '',
    concept_notes: 'Standalone storyboard builder scenes.'
  })
  return created.id
}
