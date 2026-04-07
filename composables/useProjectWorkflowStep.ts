import { workflowStepOf } from '~/lib/project-workflow'

/**
 * "Step N of M" for the current project route, accounting for hidden Story after script import.
 */
export function useProjectWorkflowStep () {
  const route = useRoute()
  const { activeProject } = useCreativeProject()

  const stepBadge = computed(() => {
    const tail = route.path.split('/').pop() || ''
    const w = workflowStepOf(tail, activeProject.value)
    if (!w) return null
    return `Step ${w.current} of ${w.total}`
  })

  return { stepBadge }
}
