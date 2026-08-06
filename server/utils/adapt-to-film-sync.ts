import type PocketBase from 'pocketbase'
import type { AdaptScene, AdaptShot, AdaptToFilmState } from '~/types/adapt-to-film'
import { normalizeCreativeSceneForPb } from '~/server/utils/creative-scene-map'

/**
 * Sync Adapt scenes/shots into creative_scenes / creative_shots so Storyboard/Video can use them later.
 * Preserves locked rows when possible by matching creativeSceneId / creativeShotId.
 */
export async function syncAdaptScenesAndShotsToCreative (
  pb: PocketBase,
  projectId: string,
  ownerId: string,
  state: AdaptToFilmState
): Promise<AdaptToFilmState> {
  const scenes = [...state.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber)
  const nextScenes: AdaptScene[] = []
  const nextShots: AdaptShot[] = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const normalized = normalizeCreativeSceneForPb(i, {
      heading: scene.title || `Scene ${scene.sceneNumber}`,
      summary: scene.summary,
      body: [
        scene.visualDescription,
        scene.narration ? `NARRATION:\n${scene.narration}` : '',
        scene.dialogue ? `DIALOGUE:\n${scene.dialogue}` : '',
        scene.sourceRefs?.[0]?.excerpt ? `SOURCE:\n${scene.sourceRefs[0].excerpt}` : ''
      ]
        .filter(Boolean)
        .join('\n\n')
    })

    let creativeSceneId = scene.creativeSceneId
    try {
      if (creativeSceneId) {
        await pb.collection('creative_scenes').update(creativeSceneId, {
          sort_order: i,
          heading: normalized.heading,
          summary: normalized.summary,
          body: normalized.body
        })
      } else {
        const created = await pb.collection('creative_scenes').create({
          owned_by: ownerId,
          project: projectId,
          sort_order: i,
          heading: normalized.heading,
          summary: normalized.summary,
          body: normalized.body
        })
        creativeSceneId = created.id
      }
    } catch {
      creativeSceneId = scene.creativeSceneId
    }

    nextScenes.push({ ...scene, creativeSceneId })

    const sceneShots = state.shots
      .filter(s => s.sceneId === scene.id)
      .sort((a, b) => a.shotNumber - b.shotNumber)

    for (let j = 0; j < sceneShots.length; j++) {
      const shot = sceneShots[j]
      let creativeShotId = shot.creativeShotId
      const payload = {
        owned_by: ownerId,
        project: projectId,
        scene: creativeSceneId,
        sort_order: j,
        title: shot.title || `Shot ${shot.shotNumber}`,
        description: shot.visualDescription || '',
        shot_type: shot.shotType || '',
        camera_move: shot.cameraMovement || '',
        duration_seconds: Number(shot.estimatedDurationSeconds) || 0,
        image_prompt: shot.imagePrompt || '',
        video_prompt: shot.videoPrompt || '',
        negative_prompt: shot.negativePrompt || ''
      }
      try {
        if (creativeShotId) {
          await pb.collection('creative_shots').update(creativeShotId, payload)
        } else if (creativeSceneId) {
          const created = await pb.collection('creative_shots').create(payload)
          creativeShotId = created.id
        }
      } catch {
        creativeShotId = shot.creativeShotId
      }
      nextShots.push({ ...shot, creativeShotId, sceneId: scene.id })
    }
  }

  // Keep shots for scenes that weren't in the loop (shouldn't happen)
  const seen = new Set(nextShots.map(s => s.id))
  for (const s of state.shots) {
    if (!seen.has(s.id)) nextShots.push(s)
  }

  return { ...state, scenes: nextScenes, shots: nextShots }
}
