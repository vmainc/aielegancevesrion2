import type { CreativeCharacter } from '~/types/creative-project'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'

export type OverviewComparableCandidate = { title: string; year?: string }

export type OverviewOmdbMovie = {
  title: string
  year?: string
  imdbId?: string
  genre?: string
  plot?: string
  poster?: string
  imdbRating?: string
  rottenTomatoes?: string
}

const PB_ID = /^[a-z0-9]{15}$/

export function useOverviewImportedInsights (options: {
  projectId: Ref<string>
  canLoad: Ref<boolean>
  showImported: Ref<boolean>
}) {
  const { getAuthToken } = useAuth()

  const candidates = ref<OverviewComparableCandidate[]>([])
  const movies = ref<OverviewOmdbMovie[]>([])
  const loadingMovies = ref(false)
  const moviesError = ref('')
  const omdbConfigured = ref<boolean | null>(null)
  const moviesWarning = ref('')

  const characters = ref<CreativeCharacter[]>([])
  const loadingCharacters = ref(false)
  const charactersError = ref('')

  async function loadMovies () {
    const id = options.projectId.value
    const token = getAuthToken()
    moviesError.value = ''
    moviesWarning.value = ''
    if (!id || !token || !PB_ID.test(id) || !options.showImported.value) {
      candidates.value = []
      movies.value = []
      omdbConfigured.value = null
      return
    }
    loadingMovies.value = true
    try {
      const res = await $fetch<{
        candidates: OverviewComparableCandidate[]
        movies: OverviewOmdbMovie[]
        omdbConfigured?: boolean
        warning?: string
      }>(`/api/projects/${id}/script-wizard/movies`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      candidates.value = res.candidates || []
      movies.value = res.movies || []
      omdbConfigured.value = res.omdbConfigured ?? null
      moviesWarning.value = res.warning || ''
    } catch (e: unknown) {
      moviesError.value = formatApiFetchError(e, 'Could not load comparable films')
      candidates.value = []
      movies.value = []
    } finally {
      loadingMovies.value = false
    }
  }

  async function loadCharacters () {
    const id = options.projectId.value
    const token = getAuthToken()
    charactersError.value = ''
    if (!id || !token || !PB_ID.test(id) || !options.showImported.value) {
      characters.value = []
      return
    }
    loadingCharacters.value = true
    try {
      const res = await $fetch<{ characters: CreativeCharacter[] }>(
        `/api/projects/${id}/characters`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      characters.value = res.characters || []
    } catch (e: unknown) {
      charactersError.value = formatApiFetchError(e, 'Could not load characters')
      characters.value = []
    } finally {
      loadingCharacters.value = false
    }
  }

  watch(
    [options.projectId, options.showImported, options.canLoad],
    () => {
      if (options.canLoad.value && options.showImported.value) {
        void loadMovies()
        void loadCharacters()
      }
    },
    { immediate: true }
  )

  return {
    candidates,
    movies,
    loadingMovies,
    moviesError,
    omdbConfigured,
    moviesWarning,
    characters,
    loadingCharacters,
    charactersError,
    loadMovies,
    loadCharacters
  }
}
