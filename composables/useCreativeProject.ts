import { getCurrentInstance, onMounted } from 'vue'
import { applyClientWorkflowOverlay, initialConceptNotesForWorkflow, writeSessionWorkflow } from '~/lib/project-workflow-mode'
import type { CreativeProject, ProjectAspectRatio, ProjectGoal, ProjectWorkflowMode } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

export function isCloudProjectId (id: string): boolean {
  return PB_ID.test(id)
}

export function useCreativeProject () {
  const route = useRoute()
  const auth = useAuth()
  const projects = useState<CreativeProject[]>('creative-projects', () => [])
  const hydrated = useState('creative-projects-hydrated', () => false)
  const clientReady = useState('creative-projects-client-ready', () => false)

  const loadServerProjects = async () => {
    if (!import.meta.client) return
    const token = auth.getAuthToken()
    if (!token) {
      projects.value = []
      hydrated.value = true
      return
    }
    try {
      const res = await $fetch<{ items: CreativeProject[] }>('/api/projects/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const serverIds = new Set(res.items.map(r => r.id))
      const recentPb = projects.value.filter(
        p => p.source === 'pocketbase' && !serverIds.has(p.id)
      )
      projects.value = [
        ...res.items.map((item) => applyClientWorkflowOverlay(item)),
        ...recentPb.map(p => applyClientWorkflowOverlay(p))
      ]
      hydrated.value = true
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message || '')
          : e instanceof Error
            ? e.message
            : ''
      console.warn('Failed to load PocketBase projects:', msg)
      hydrated.value = true
    }
  }

  const hydrate = () => {
    if (!import.meta.client) return
    if (auth.isAuthenticated.value) {
      void loadServerProjects()
    } else {
      projects.value = []
      hydrated.value = true
    }
  }

  const getById = (id: string) => {
    const hit = projects.value.find(p => p.id === id)
    return hit ? applyClientWorkflowOverlay(hit) : null
  }

  const createProject = async (input: {
    name: string
    aspectRatio: ProjectAspectRatio
    goal: ProjectGoal
    workflowMode?: ProjectWorkflowMode
  }): Promise<CreativeProject> => {
    const token = auth.getAuthToken()
    if (!token) {
      throw new Error('Sign in to create a project')
    }
    const res = await $fetch<{ project: CreativeProject }>('/api/projects/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: input.name.trim() || 'Untitled project',
        aspectRatio: input.aspectRatio,
        goal: input.goal,
        workflowMode: input.workflowMode || 'import'
      }
    })
    const project = applyClientWorkflowOverlay(res.project)
    writeSessionWorkflow(project.id, project.workflowMode ?? 'import')
    projects.value = [project, ...projects.value.filter(p => p.id !== project.id)]
    hydrated.value = true
    return project
  }

  const registerImportedProject = (p: CreativeProject) => {
    hydrated.value = true
    const next = applyClientWorkflowOverlay(p)
    writeSessionWorkflow(next.id, next.workflowMode ?? 'import')
    const without = projects.value.filter(x => x.id !== p.id)
    projects.value = [next, ...without]
  }

  const updateProject = async (
    id: string,
    patch: Partial<Omit<CreativeProject, 'id' | 'createdAt' | 'source'>>
  ) => {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return

    const current = projects.value[idx]
    if (!isCloudProjectId(id)) {
      throw new Error('Only cloud projects can be updated')
    }

    const token = auth.getAuthToken()
    if (!token) return
    try {
      const body: Record<string, unknown> = {}
      if (patch.synopsis !== undefined) body.synopsis = patch.synopsis
      if (patch.conceptNotes !== undefined) body.conceptNotes = patch.conceptNotes
      if (patch.treatment !== undefined) body.treatment = patch.treatment
      if (patch.name !== undefined) body.name = patch.name
      if (patch.aspectRatio !== undefined) body.aspectRatio = patch.aspectRatio
      if (patch.goal !== undefined) body.goal = patch.goal
      if (patch.workflowMode !== undefined) body.workflowMode = patch.workflowMode
      if (patch.genre !== undefined) body.genre = patch.genre
      if (patch.tone !== undefined) body.tone = patch.tone
      if (patch.targetLength !== undefined) body.targetLength = patch.targetLength
      if (patch.targetDurationSeconds !== undefined) {
        body.targetDurationSeconds = patch.targetDurationSeconds
      }
      if (patch.director !== undefined) body.director = patch.director
      if (patch.continuityMemory !== undefined) body.continuityMemory = patch.continuityMemory
      if (patch.continuityLastIssues !== undefined) body.continuityLastIssues = patch.continuityLastIssues

      const res = await $fetch<{ project: CreativeProject }>(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body
      })
      const merged = applyClientWorkflowOverlay(res.project)
      if (patch.workflowMode) writeSessionWorkflow(id, merged.workflowMode)
      const copy = [...projects.value]
      copy[idx] = merged
      projects.value = copy
    } catch (e) {
      console.error('updateProject API failed', e)
      throw e
    }
  }

  const deleteProject = async (id: string) => {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return
    if (isCloudProjectId(id)) {
      const token = auth.getAuthToken()
      if (!token) throw new Error('Not signed in')
      await $fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    }
    projects.value = projects.value.filter(p => p.id !== id)
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
        projects.value = []
        hydrated.value = true
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
          hydrated.value = true
        }
      }
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
    isCloudProjectId
  }
}
