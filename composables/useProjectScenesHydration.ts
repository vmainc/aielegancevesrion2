import type { CreativeSceneListItem } from '~/types/creative-scene'
import {
  buildSceneMetaMap,
  type SceneMetaMap
} from '~/lib/project-scene-groups'

const POCKETBASE_ID = /^[a-z0-9]{15}$/

const sceneMapByProject = new Map<string, SceneMetaMap>()
const inflightByProject = new Map<string, Promise<void>>()

/**
 * Loads creative_scenes headings per project (cached) for video library / timeline grouping.
 */
export function useProjectScenesHydration () {
  const { isAuthenticated, getAuthToken, initAuth } = useAuth()
  const revision = ref(0)

  function getSceneMap (projectId: string): SceneMetaMap {
    void revision.value
    return sceneMapByProject.get(projectId) ?? new Map()
  }

  async function ensureProject (projectId: string): Promise<void> {
    if (!POCKETBASE_ID.test(projectId)) return
    if (sceneMapByProject.has(projectId)) return
    const pending = inflightByProject.get(projectId)
    if (pending) return pending

    const run = (async () => {
      if (!isAuthenticated.value) return
      await initAuth()
      const token = getAuthToken()
      if (!token) return
      try {
        const res = await $fetch<{ scenes: CreativeSceneListItem[] }>(
          `/api/projects/${projectId}/scenes`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        sceneMapByProject.set(projectId, buildSceneMetaMap(res.scenes || []))
      } catch {
        // Leave uncached so a later ensureProjects can retry; UI falls back to short ids.
      } finally {
        inflightByProject.delete(projectId)
        revision.value++
      }
    })()

    inflightByProject.set(projectId, run)
    return run
  }

  async function ensureProjects (projectIds: string[]): Promise<void> {
    const unique = [...new Set(projectIds.filter(id => POCKETBASE_ID.test(id)))]
    await Promise.all(unique.map(id => ensureProject(id)))
  }

  function invalidateProject (projectId: string) {
    sceneMapByProject.delete(projectId)
    revision.value++
  }

  return {
    getSceneMap,
    ensureProject,
    ensureProjects,
    invalidateProject,
    revision
  }
}
