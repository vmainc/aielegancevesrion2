import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'

/**
 * Delete existing storyboard frame assets for a shot + role so the new generation becomes the panel image.
 */
export async function replaceStoryboardFrameAssetsForShot (options: {
  pb: { collection: (name: string) => any }
  projectId: string
  shotId: string
  sceneId?: string | null
  frameRole: StoryboardFrameRole
}): Promise<number> {
  const shotId = options.shotId.trim()
  const projectId = options.projectId.trim()
  if (!shotId || !projectId) return 0

  let deleted = 0
  try {
    const list = await options.pb.collection('project_assets').getFullList({
      filter: `project = "${projectId}" && kind = "storyboard"`,
      fields: 'id,metadata'
    })
    for (const row of list) {
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {}
      const metaShot =
        typeof meta.shot_id === 'string'
          ? meta.shot_id.trim()
          : typeof meta.shotId === 'string'
            ? meta.shotId.trim()
            : ''
      if (metaShot !== shotId) continue
      const role = meta.frame_role === 'end' ? 'end' : 'start'
      if (role !== options.frameRole) continue
      try {
        await options.pb.collection('project_assets').delete(String(row.id))
        deleted += 1
      } catch {
        /* continue */
      }
    }
  } catch (err) {
    console.warn('[image-generate] could not list storyboard assets for replace', {
      message: err instanceof Error ? err.message : String(err)
    })
  }
  return deleted
}
