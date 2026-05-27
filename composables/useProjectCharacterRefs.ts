import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

type PortraitBundle = {
  url: string
  notes: string
  promptUsed: string
}

function portraitMapFromAssets (
  characters: CreativeCharacter[],
  assets: ProjectAsset[],
  token: string | null
): Map<string, PortraitBundle> {
  const byCharacterId: Record<string, PortraitBundle & { ts: string; featured: boolean }> = {}
  const byCharacterName: Record<string, PortraitBundle & { ts: string; featured: boolean }> = {}

  for (const a of assets) {
    if (!a.fileUrl && !a.id) continue
    const meta = a.metadata || {}
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalizeName(meta.character_name) : ''
    const ts = a.updated || a.created || ''
    const featured = meta && typeof meta === 'object' && meta.featured === true
    const notes = (a.notes || '').trim()
    const promptUsed =
      typeof meta.prompt_used === 'string'
        ? meta.prompt_used.trim()
        : typeof (meta as { promptUsed?: string }).promptUsed === 'string'
          ? String((meta as { promptUsed?: string }).promptUsed).trim()
          : ''
    const url =
      a.projectId && a.id && PB_ID.test(a.projectId)
        ? appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), token)
        : (a.fileUrl || '').trim()
    if (!url && !notes && !promptUsed) continue

    const bundle = { url, notes, promptUsed }

    if (cid) {
      const prev = byCharacterId[cid]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        byCharacterId[cid] = { ...bundle, ts, featured }
      }
    }
    if (cname) {
      const prev = byCharacterName[cname]
      if (!prev || (featured && !prev.featured) || (featured === prev.featured && ts > prev.ts)) {
        byCharacterName[cname] = { ...bundle, ts, featured }
      }
    }
  }

  const out = new Map<string, PortraitBundle>()
  for (const c of characters) {
    const hitById = byCharacterId[c.id]
    if (hitById) {
      out.set(c.id, { url: hitById.url, notes: hitById.notes, promptUsed: hitById.promptUsed })
      continue
    }
    const hitByName = byCharacterName[normalizeName(c.name)]
    if (hitByName) {
      out.set(c.id, {
        url: hitByName.url,
        notes: hitByName.notes,
        promptUsed: hitByName.promptUsed
      })
    }
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
      refs.value = characters.map(c => {
        const p = portraits.get(c.id)
        return {
          id: c.id,
          name: c.name,
          roleDescription: c.roleDescription || '',
          portraitUrl: p?.url || null,
          portraitNotes: p?.notes || '',
          portraitPromptUsed: p?.promptUsed || ''
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
