import type PocketBase from 'pocketbase'
import type { GeneratedShot } from '~/server/utils/generate-shots-ai'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'

/**
 * Replace all creative_shots for a scene with a new generated list (storyboard / shot list).
 */
export async function replaceSceneShots (
  pb: PocketBase,
  userId: string,
  projectId: string,
  sceneId: string,
  shots: GeneratedShot[]
): Promise<ReturnType<typeof pbRecordToCreativeShot>[]> {
  let existing: { id: string }[] = []
  try {
    existing = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      batch: 500
    })
  } catch {
    throw new Error('creative_shots collection missing or not readable')
  }
  for (const row of existing) {
    await pb.collection('creative_shots').delete(row.id)
  }

  const created: ReturnType<typeof pbRecordToCreativeShot>[] = []
  for (let i = 0; i < shots.length; i++) {
    const g = shots[i]!
    const rec = await pb.collection('creative_shots').create({
      owned_by: userId,
      project: projectId,
      scene: sceneId,
      sort_order: g.order - 1,
      title: g.title,
      description: g.description,
      shot_type: g.shot_type,
      camera_move: g.camera_move,
      duration_seconds: g.duration_seconds,
      image_prompt: g.image_prompt,
      video_prompt: g.video_prompt
    })
    created.push(pbRecordToCreativeShot(rec as Parameters<typeof pbRecordToCreativeShot>[0]))
  }
  created.sort((a, b) => a.sortOrder - b.sortOrder)
  return created
}
