import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function portraitMapFromAssets (
  characters: CreativeCharacter[],
  assets: ProjectAsset[],
  token: string | null
): Map<string, string> {
  const byCharacterId: Record<string, { url: string; ts: string; featured: boolean }> = {}
  const byCharacterName: Record<string, { url: string; ts: string; featured: boolean }> = {}

  for (const a of assets) {
    if (!a.fileUrl && !a.id) continue
    const meta = a.metadata || {}
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const ts = a.updated || a.created || ''
    const featured = meta && typeof meta === 'object' && meta.featured === true
    const url =
      a.projectId && a.id && PB_ID.test(a.projectId)
        ? appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), token)
        : (a.fileUrl || '').trim()
    if (!url) continue

    if (cid) {
      const prev = byCharacterId[cid]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        byCharacterId[cid] = { url, ts, featured }
      }
    }
    if (cname) {
      const prev = byCharacterName[cname]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        byCharacterName[cname] = { url, ts, featured }
      }
    }
  }

  const out = new Map<string, string>()
  for (const c of characters) {
    const hitById = byCharacterId[c.id]
    if (hitById?.url) {
      out.set(c.id, hitById.url)
      continue
    }
    const hitByName = byCharacterName[normalizeName(c.name)]
    if (hitByName?.url) out.set(c.id, hitByName.url)
  }
  return out
}

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
      const portraits = portraitMapFromAssets(characters, assetRes.items || [], token)
      refs.value = characters.map(c => ({
        id: c.id,
        name: c.name,
        roleDescription: c.roleDescription || '',
        portraitUrl: portraits.get(c.id) || null
      }))
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
