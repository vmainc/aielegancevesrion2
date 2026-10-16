import type PocketBase from 'pocketbase'
import { resolveSetLock, type SetLock } from '~/lib/set-lock'
import { pbRecordToBibleEntity } from '~/server/utils/bible-entity-map'
import { pbRecordToBibleRelationship } from '~/server/utils/bible-relationship-map'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'

export interface SetLockInputs {
  entities: BibleEntity[]
  relationships: BibleRelationship[]
}

async function safeRows (
  pb: PocketBase,
  collection: string,
  projectId: string
): Promise<Array<Record<string, unknown>>> {
  try {
    const rows = await pb.collection(collection).getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
    return rows as unknown as Array<Record<string, unknown>>
  } catch {
    return []
  }
}

export async function loadSetLockInputs (
  pb: PocketBase,
  projectId: string
): Promise<SetLockInputs> {
  const [entityRows, relRows] = await Promise.all([
    safeRows(pb, 'bible_entities', projectId),
    safeRows(pb, 'bible_relationships', projectId)
  ])
  return {
    entities: entityRows.map((r) => pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])),
    relationships: relRows.map((r) => pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0]))
  }
}

export function setLockForHeading (heading: string, inputs: SetLockInputs): SetLock | null {
  return resolveSetLock({
    sceneHeading: heading,
    entities: inputs.entities,
    relationships: inputs.relationships
  })
}
