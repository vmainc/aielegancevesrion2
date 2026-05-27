import { defaultDurationSecondsForProject } from '~/lib/project-duration-budget'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

/**
 * Target runtime (seconds) input synced with a cloud project's `targetDurationSeconds`.
 */
export function useProjectTargetDuration (projectId: Ref<string | undefined>) {
  const { projects, updateProject } = useCreativeProject()
  const toast = useToast()

  const targetDurationSeconds = ref('')
  const targetDurationTouched = ref(false)

  const project = computed(() => {
    const id = (projectId.value || '').trim()
    if (!id) return undefined
    return projects.value.find((p: CreativeProject) => p.id === id)
  })

  const canPersist = computed(
    () => PB_ID.test((projectId.value || '').trim())
  )

  function parsedTargetDurationSeconds (): number | null {
    const raw = String(targetDurationSeconds.value || '').trim()
    if (!raw) return null
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n) || n < 15 || n > 3600) return null
    return n
  }

  function onTargetDurationInput () {
    targetDurationTouched.value = true
  }

  function syncFromProject (forceDefault = false) {
    const p = project.value
    if (!p) {
      targetDurationSeconds.value = ''
      return
    }
    if (typeof p.targetDurationSeconds === 'number' && p.targetDurationSeconds > 0) {
      targetDurationSeconds.value = String(p.targetDurationSeconds)
      return
    }
    if (!targetDurationTouched.value || forceDefault) {
      const def = defaultDurationSecondsForProject({
        goal: p.goal,
        targetLength: p.targetLength
      })
      targetDurationSeconds.value = def != null ? String(def) : ''
    }
  }

  watch(projectId, () => {
    targetDurationTouched.value = false
    syncFromProject(true)
  }, { immediate: true })

  watch(
    () => project.value?.targetDurationSeconds,
    (v) => {
      if (targetDurationTouched.value) return
      if (typeof v === 'number' && v > 0) {
        targetDurationSeconds.value = String(v)
      }
    }
  )

  watch(
    () => [project.value?.goal, project.value?.targetLength] as const,
    () => {
      if (!targetDurationTouched.value) syncFromProject(true)
    }
  )

  async function persistTargetDuration (): Promise<boolean> {
    const id = (projectId.value || '').trim()
    if (!id || !canPersist.value) return false
    const n = parsedTargetDurationSeconds()
    try {
      await updateProject(id, { targetDurationSeconds: n })
      targetDurationTouched.value = true
      return true
    } catch {
      toast.showToast('Could not save target runtime.', 'error')
      return false
    }
  }

  return {
    targetDurationSeconds,
    targetDurationTouched,
    parsedTargetDurationSeconds,
    onTargetDurationInput,
    persistTargetDuration,
    canPersist,
    syncFromProject
  }
}
