import { getCurrentInstance, onMounted } from 'vue'
import { defaultDirector } from '~/lib/director-presets'
import type { CreativeProject, ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const STORAGE_KEY = 'aielegance-creative-projects'

function nowIso () {
  return new Date().toISOString()
}

function mockSeed (): CreativeProject[] {
  const t = nowIso()
  return [
    {
      id: 'demo-neon-dreams',
      name: 'Neon Dreams',
      aspectRatio: '16:9',
      goal: 'film',
      synopsis: 'A courier crosses a rain-soaked megacity to deliver a memory that was never hers.',
      treatment: '',
      conceptNotes: 'Blade Runner tone, practical neon where possible.',
      createdAt: t,
      updatedAt: t,
      source: 'local'
    },
    {
      id: 'demo-vertical-drop',
      name: 'Vertical Drop',
      aspectRatio: '9:16',
      goal: 'social',
      synopsis: '',
      treatment: '',
      conceptNotes: '',
      createdAt: t,
      updatedAt: t,
      source: 'local'
    }
  ]
}

export function useCreativeProject () {
  const route = useRoute()
  const auth = useAuth()
  const projects = useState<CreativeProject[]>('creative-projects', () => [])
  const hydrated = useState('creative-projects-hydrated', () => false)
  const clientReady = useState('creative-projects-client-ready', () => false)

  const persistLocal = () => {
    if (!import.meta.client) return
    try {
      const locals = projects.value.filter(p => p.source !== 'pocketbase')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locals))
    } catch {
      /* ignore quota */
    }
  }

  const hydrateLocalOnly = () => {
    if (!import.meta.client || hydrated.value) return
    hydrated.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CreativeProject[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          projects.value = parsed.map(p => ({
            ...p,
            source: p.source || 'local',
            director: p.director ?? defaultDirector(),
            continuityMemory: p.continuityMemory ?? '',
            continuityLastIssues: p.continuityLastIssues ?? ''
          }))
          return
        }
      }
    } catch {
      /* ignore */
    }
    projects.value = mockSeed()
    persistLocal()
  }

  const loadServerProjects = async () => {
    if (!import.meta.client) return
    const token = auth.getAuthToken()
    if (!token) {
      hydrateLocalOnly()
      return
    }
    try {
      const res = await $fetch<{ items: CreativeProject[] }>('/api/projects/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const locals = projects.value.filter(p => p.source === 'local' || !p.source)
      const merged = [...res.items, ...locals.filter(l => !res.items.some(r => r.id === l.id))]
      projects.value = merged
      hydrated.value = true
    } catch (e: any) {
      console.warn('Failed to load PocketBase projects:', e?.data?.message || e?.message)
      hydrateLocalOnly()
    }
  }

  const hydrate = () => {
    if (!import.meta.client) return
    if (auth.isAuthenticated.value) {
      void loadServerProjects()
    } else {
      hydrateLocalOnly()
    }
  }

  const getById = (id: string) => projects.value.find(p => p.id === id) ?? null

  const createProject = (input: {
    name: string
    aspectRatio: ProjectAspectRatio
    goal: ProjectGoal
  }): CreativeProject => {
    if (!hydrated.value) hydrateLocalOnly()
    const t = nowIso()
    const project: CreativeProject = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? `proj-${crypto.randomUUID()}`
        : `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: input.name.trim() || 'Untitled project',
      aspectRatio: input.aspectRatio,
      goal: input.goal,
      synopsis: '',
      treatment: '',
      conceptNotes: '',
      director: defaultDirector(),
      continuityMemory: '',
      continuityLastIssues: '',
      createdAt: t,
      updatedAt: t,
      source: 'local'
    }
    projects.value = [...projects.value, project]
    return project
  }

  const registerImportedProject = (p: CreativeProject) => {
    hydrated.value = true
    const without = projects.value.filter(x => x.id !== p.id)
    projects.value = [p, ...without]
  }

  const updateProject = async (
    id: string,
    patch: Partial<Omit<CreativeProject, 'id' | 'createdAt' | 'source'>>
  ) => {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return

    const current = projects.value[idx]
    if (current.source === 'pocketbase') {
      const token = auth.getAuthToken()
      if (!token) return
      try {
        const body: Record<string, unknown> = {
          synopsis: patch.synopsis,
          conceptNotes: patch.conceptNotes,
          treatment: patch.treatment,
          name: patch.name,
          aspectRatio: patch.aspectRatio,
          goal: patch.goal,
          genre: patch.genre,
          tone: patch.tone
        }
        if (patch.director !== undefined) body.director = patch.director
        if (patch.continuityMemory !== undefined) body.continuityMemory = patch.continuityMemory
        if (patch.continuityLastIssues !== undefined) body.continuityLastIssues = patch.continuityLastIssues

        const res = await $fetch<{ project: CreativeProject }>(`/api/projects/${id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body
        })
        const copy = [...projects.value]
        copy[idx] = res.project
        projects.value = copy
      } catch (e) {
        console.error('updateProject API failed', e)
        throw e
      }
      return
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: nowIso()
    } as CreativeProject
    const copy = [...projects.value]
    copy[idx] = next
    projects.value = copy
    persistLocal()
  }

  const deleteProject = async (id: string) => {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return
    const current = projects.value[idx]
    if (current.source === 'pocketbase') {
      const token = auth.getAuthToken()
      if (!token) throw new Error('Not signed in')
      await $fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    }
    projects.value = projects.value.filter(p => p.id !== id)
    persistLocal()
  }

  const activeProjectId = computed(() => {
    const p = route.params.projectId
    return typeof p === 'string' ? p : Array.isArray(p) ? p[0] ?? '' : ''
  })

  const activeProject = computed(() => {
    const id = activeProjectId.value
    if (!id) return null
    return getById(id)
  })

  const withProjectQuery = (path: string) => {
    const id = activeProjectId.value
    if (!id) return path
    const join = path.includes('?') ? '&' : '?'
    return `${path}${join}project=${encodeURIComponent(id)}`
  }

  if (import.meta.client) {
    const runClientHydrate = async () => {
      if (auth.isAuthenticated.value) {
        await loadServerProjects()
      } else {
        hydrateLocalOnly()
      }
      clientReady.value = true
    }
    if (getCurrentInstance()) {
      onMounted(() => {
        void runClientHydrate()
      })
    } else {
      void runClientHydrate()
    }

    watch(
      () => auth.isAuthenticated.value,
      async (loggedIn) => {
        if (!clientReady.value) return
        if (loggedIn) {
          await loadServerProjects()
        } else {
          hydrated.value = false
          projects.value = []
          hydrateLocalOnly()
        }
      }
    )

    watch(
      projects,
      () => {
        if (hydrated.value) persistLocal()
      },
      { deep: true }
    )
  }

  return {
    projects,
    hydrated,
    clientReady,
    hydrate,
    loadServerProjects,
    getById,
    createProject,
    registerImportedProject,
    updateProject,
    deleteProject,
    activeProjectId,
    activeProject,
    withProjectQuery,
    persist: persistLocal
  }
}
