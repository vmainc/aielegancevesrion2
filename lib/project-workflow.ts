import type { CreativeProject } from '~/types/creative-project'

/** Present in `treatment` after full script import AI (see `enrichmentToProjectFields`). */
export const IMPORTED_SCRIPT_TREATMENT_MARKER = 'Imported script — creative development'

/** Story tab content is already satisfied by screenplay import + analysis. */
export function projectStorySatisfiedByScriptImport (
  project: Pick<CreativeProject, 'treatment'> | null | undefined
): boolean {
  const t = project?.treatment || ''
  return t.includes(IMPORTED_SCRIPT_TREATMENT_MARKER)
}

const WORKFLOW_PATHS = [
  'overview',
  'director',
  'story',
  'characters',
  'scenes',
  'storyboard',
  'video'
] as const

export type WorkflowPath = (typeof WORKFLOW_PATHS)[number]

export function workflowPathsForProject (
  project: Pick<CreativeProject, 'treatment'> | null | undefined
): readonly string[] {
  if (projectStorySatisfiedByScriptImport(project)) {
    return WORKFLOW_PATHS.filter(p => p !== 'story')
  }
  return WORKFLOW_PATHS
}

export function workflowStepOf (
  path: string,
  project: Pick<CreativeProject, 'treatment'> | null | undefined
): { current: number; total: number } | null {
  const paths = workflowPathsForProject(project)
  const idx = paths.indexOf(path)
  if (idx < 0) return null
  return { current: idx + 1, total: paths.length }
}
