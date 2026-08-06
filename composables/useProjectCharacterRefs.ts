import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import { buildCharacterPlateMap } from '~/lib/character-plate-refs'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

export function useProjectCharacterRefs (projectId: Ref<string> | ComputedRef<string>) {
  const { getAuthToken, isAuthenticated } = useAuth()
  const refs = ref<ProjectCharacterRef[]>([])
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
      const [charRes, assetRes] = await Promise.all([
        $fetch<{ characters: CreativeCharacter[] }>(`/api/projects/${pid}/characters`, { headers }),
        $fetch<{ items: ProjectAsset[] }>(`/api/projects/${pid}/assets?kind=character`, { headers })
      ])
      const characters = charRes.characters || []
      const plates = buildCharacterPlateMap(
        characters,
        assetRes.items || [],
        (a) =>
          a.projectId && a.id && PB_ID.test(a.projectId)
            ? appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), token)
            : (a.fileUrl || '').trim()
      )
      refs.value = characters.map(c => {
        const p = plates.get(c.id)
        return {
          id: c.id,
          name: c.name,
          roleDescription: c.roleDescription || '',
          portraitUrl: p?.url || null,
          plateUrls: p?.plateUrls || [],
          portraitNotes: p?.notes || '',
          portraitPromptUsed: p?.promptUsed || '',
          voiceDescription: c.voiceDescription || '',
          appearanceDescription: c.appearanceDescription || '',
          signatureDetails: c.signatureDetails || '',
          avoidDescription: c.avoidDescription || ''
        }
      })
    } catch (e: unknown) {
      refs.value = []
      loadError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message || 'Could not load cast')
          : 'Could not load cast'
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
