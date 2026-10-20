import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { setPlateUrlsForEntity } from '~/lib/set-lock'
import type { BibleEntity } from '~/types/bible-entity'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

export type ProjectLocationRef = {
  id: string
  name: string
  summary: string
  architecture: string
  status: string
  plateUrls: string[]
  featuredPlateUrl: string | null
}

export function useProjectLocationRefs (projectId: Ref<string> | ComputedRef<string>) {
  const { getAuthToken, isAuthenticated } = useAuth()
  const refs = ref<ProjectLocationRef[]>([])
  const loading = ref(false)
  const loadError = ref('')

  async function load () {
    const pid = unref(projectId)
    if (!pid || !PB_ID.test(pid) || !isAuthenticated.value) {
      refs.value = []
      return
    }
    const token = getAuthToken()
    if (!token) {
      refs.value = []
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [entityRes, assetRes] = await Promise.all([
        $fetch<{ entities: BibleEntity[] }>(`/api/projects/${pid}/bible/entities`, { headers }),
        $fetch<{ items: ProjectAsset[] }>(`/api/projects/${pid}/assets`, { headers })
      ])
      const playback = (a: ProjectAsset) =>
        a.projectId && a.id && PB_ID.test(a.projectId)
          ? appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), token)
          : (a.fileUrl || '').trim()

      const locations = (entityRes.entities || []).filter(
        (e) => e.type === 'location' && e.status !== 'retired'
      )
      const assets = assetRes.items || []
      refs.value = locations
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => {
          const plateUrls = setPlateUrlsForEntity(e.id, assets, playback)
          return {
            id: e.id,
            name: e.name,
            summary: (e.summary || '').trim(),
            architecture: (e.description || '').trim(),
            status: e.status,
            plateUrls,
            featuredPlateUrl: plateUrls[0] || null
          }
        })
    } catch (e: unknown) {
      refs.value = []
      loadError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message || 'Could not load locations')
          : 'Could not load locations'
    } finally {
      loading.value = false
    }
  }

  watch(
    () => unref(projectId),
    () => {
      void load()
    },
    { immediate: true }
  )

  watch(isAuthenticated, (v) => {
    if (v) void load()
    else refs.value = []
  })

  return { refs, loading, loadError, reload: load }
}
