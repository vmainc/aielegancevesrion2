import {
  conceptNotesHaveUserContent,
  parseCharactersFromConceptNotes,
  parseLoglineFromConceptNotes,
  stripConceptMetadataMarkers
} from '~/lib/format-stored-concept'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { pollScriptImportJob } from '~/lib/poll-script-import-job'
import {
  isScratchWorkflowProject,
  projectStorySatisfiedByScriptImport
} from '~/lib/project-workflow'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { CreativeProject, ProjectDirector } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

export function useScratchConceptBootstrap (options?: {
  /** e.g. persist target runtime from Story step form before server build */
  persistBeforeBootstrap?: () => Promise<void>
}) {
  const { activeProject, activeProjectId, registerImportedProject, withProjectQuery } =
    useCreativeProject()
  const { isAuthenticated, getAuthToken } = useAuth()
  const toast = useToast()

  const projectId = activeProjectId
  const project = activeProject

  const conceptBootstrapRunning = ref(false)
  const conceptBootstrapError = ref('')
  const pipelineBuilt = ref<boolean | null>(null)

  const scratchWorkflow = computed(() => isScratchWorkflowProject(project.value))
  const showImportedScriptOverview = computed(() =>
    projectStorySatisfiedByScriptImport(project.value)
  )
  const canCloudImport = computed(() => isAuthenticated.value && PB_ID.test(projectId.value))

  const hasConcept = computed(() => {
    const p = project.value
    if (!p) return false
    return Boolean((p.synopsis || '').trim() || conceptNotesHaveUserContent(p.conceptNotes || ''))
  })

  const showConceptBootstrapCta = computed(
    () =>
      scratchWorkflow.value &&
      canCloudImport.value &&
      hasConcept.value &&
      !showImportedScriptOverview.value &&
      !conceptBootstrapRunning.value &&
      pipelineBuilt.value === false
  )

  /** Help copy on Story when the pipeline is not built yet (includes while we check the server). */
  const scratchNeedsDirectorBuild = computed(
    () =>
      scratchWorkflow.value &&
      canCloudImport.value &&
      hasConcept.value &&
      !showImportedScriptOverview.value &&
      pipelineBuilt.value !== true
  )

  async function loadPipelineBuilt () {
    const id = projectId.value
    const token = getAuthToken()
    if (!scratchWorkflow.value || !id || !token || !PB_ID.test(id)) {
      pipelineBuilt.value = null
      return
    }
    if (showImportedScriptOverview.value) {
      pipelineBuilt.value = true
      return
    }
    try {
      const res = await $fetch<{ scenes: unknown[] }>(`/api/projects/${id}/scenes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      pipelineBuilt.value = (res.scenes?.length ?? 0) > 0
    } catch {
      pipelineBuilt.value = false
    }
  }

  watch(
    () =>
      [
        projectId.value,
        scratchWorkflow.value,
        hasConcept.value,
        showImportedScriptOverview.value,
        canCloudImport.value
      ] as const,
    () => {
      void loadPipelineBuilt()
    },
    { immediate: true }
  )

  function resolveBootstrapSummary (p: CreativeProject | null | undefined, override?: string): string {
    const fromOverride = (override || '').trim()
    if (fromOverride) return fromOverride
    const syn = (p?.synopsis || '').trim()
    if (syn) return syn
    const logline = parseLoglineFromConceptNotes(p?.conceptNotes || '')
    if (logline) return logline
    return stripConceptMetadataMarkers(p?.conceptNotes || '')
  }

  async function runConceptBootstrap (opts?: {
    title?: string
    logline?: string
    summary?: string
    genre?: string
    tone?: string
    characters?: string[]
    director?: ProjectDirector
    visualReference?: string
  }) {
    const id = projectId.value
    const token = getAuthToken()
    if (!id || !token) return
    const p = project.value
    const title = (opts?.title || p?.name || '').trim()
    const summary = resolveBootstrapSummary(p, opts?.summary)
    if (!title || !summary) {
      conceptBootstrapError.value =
        'Add a story synopsis first (generate ideas and pick one, or paste your idea), then build again.'
      toast.showToast(conceptBootstrapError.value, 'error')
      return
    }
    if (options?.persistBeforeBootstrap) {
      await options.persistBeforeBootstrap()
    }
    conceptBootstrapRunning.value = true
    conceptBootstrapError.value = ''
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    try {
      const body = {
        title,
        logline: opts?.logline || parseLoglineFromConceptNotes(p?.conceptNotes || '') || summary.split('\n')[0],
        summary,
        genre: opts?.genre || p?.genre,
        tone: opts?.tone || p?.tone,
        characters: opts?.characters?.length
          ? opts.characters
          : parseCharactersFromConceptNotes(p?.conceptNotes || ''),
        ...(opts?.director ? { director: opts.director } : {}),
        ...(opts?.visualReference ? { visual_reference: opts.visualReference } : {})
      }
      const started = await $fetch<{ async: boolean; jobId: string }>(
        `/api/projects/${id}/bootstrap-from-concept`,
        { method: 'POST', headers, body }
      )
      if (!started.jobId) {
        throw new Error('Server did not start build job')
      }
      const polled = await pollScriptImportJob(started.jobId, headers, {
        maxMs: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
      })
      registerImportedProject(polled.project)
      pipelineBuilt.value = true
      toast.showToast('Project built — review your cast on Characters.', 'success')
      await navigateTo(withProjectQuery(`/projects/${id}/characters`))
    } catch (e: unknown) {
      conceptBootstrapError.value = formatApiFetchError(
        e,
        'Could not build project from this story. Try again or use Claude instead of Llama for faster results.'
      )
      toast.showToast(conceptBootstrapError.value, 'error')
    } finally {
      conceptBootstrapRunning.value = false
    }
  }

  const directorBootstrapPanelVisible = computed(
    () =>
      scratchWorkflow.value &&
      canCloudImport.value &&
      hasConcept.value &&
      !showImportedScriptOverview.value &&
      pipelineBuilt.value === false
  )

  return {
    conceptBootstrapRunning,
    conceptBootstrapError,
    pipelineBuilt,
    showConceptBootstrapCta,
    scratchNeedsDirectorBuild,
    directorBootstrapPanelVisible,
    runConceptBootstrap,
    loadPipelineBuilt
  }
}
