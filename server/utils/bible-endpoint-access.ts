import { createError } from 'h3'
import type PocketBase from 'pocketbase'
import { bibleRelId, requireOwnedProjectRow } from '~/server/utils/bible-project-access'
import { projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import { projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'

function projectIdOnShotRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

function projectIdOnAssetRow (raw: Record<string, unknown>): string {
  return bibleRelId(raw.project as string | { id?: string } | undefined)
}

/** Verify a relationship endpoint references an object in the same project when resolvable. */
export async function assertBibleEndpointInProject (
  pb: PocketBase,
  userId: string,
  projectId: string,
  endpointType: string,
  endpointId: string
): Promise<void> {
  if (endpointType === 'project') {
    if (endpointId !== projectId) {
      throw createError({ statusCode: 400, message: 'Project endpoint id must match the project in the URL' })
    }
    return
  }

  if (endpointType === 'bible_entity') {
    await requireOwnedProjectRow(
      pb,
      userId,
      'bible_entities',
      endpointId,
      projectId,
      projectIdOnBibleEntityRow,
      'Entity'
    )
    return
  }

  if (endpointType === 'creative_character') {
    await requireOwnedProjectRow(
      pb,
      userId,
      'creative_characters',
      endpointId,
      projectId,
      projectIdOnCharacterRow,
      'Character'
    )
    return
  }

  if (endpointType === 'scene') {
    await requireOwnedProjectRow(
      pb,
      userId,
      'creative_scenes',
      endpointId,
      projectId,
      projectIdOnSceneRow,
      'Scene'
    )
    return
  }

  if (endpointType === 'shot') {
    await requireOwnedProjectRow(
      pb,
      userId,
      'creative_shots',
      endpointId,
      projectId,
      projectIdOnShotRow,
      'Shot'
    )
    return
  }

  if (endpointType === 'asset') {
    await requireOwnedProjectRow(
      pb,
      userId,
      'project_assets',
      endpointId,
      projectId,
      projectIdOnAssetRow,
      'Asset'
    )
  }

  // timeline_clip and generation_job are not persisted yet — type/id format only.
}
