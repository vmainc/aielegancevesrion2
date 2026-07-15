import type { CreativeProject, ProjectWorkflowMode } from '~/types/creative-project'
import { resolveProjectWorkflowMode } from '~/lib/project-workflow-mode'

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
  'home',
  'overview',
  'director',
  'story',
  'characters',
  'scenes',
  'storyboard',
  'video'
] as const

export type WorkflowPath = (typeof WORKFLOW_PATHS)[number]

export type ProjectWorkflowInput =
  | Pick<CreativeProject, 'id' | 'workflowMode' | 'conceptNotes'>
  | null
  | undefined

export function projectWorkflowMode (project: ProjectWorkflowInput): ProjectWorkflowMode {
  if (!project?.id) return 'import'
  return resolveProjectWorkflowMode(project)
}

export function isImportWorkflowProject (project: ProjectWorkflowInput): boolean {
  return projectWorkflowMode(project) === 'import'
}

export function isIdeaWorkflowProject (project: ProjectWorkflowInput): boolean {
  return projectWorkflowMode(project) === 'idea'
}

export function isGenerateWorkflowProject (project: ProjectWorkflowInput): boolean {
  return projectWorkflowMode(project) === 'generate'
}

/** Idea-first projects (own idea or AI-generated) skip the Script sidebar step. */
export function isIdeaFirstWorkflowProject (project: ProjectWorkflowInput): boolean {
  const mode = projectWorkflowMode(project)
  return mode === 'idea' || mode === 'generate'
}

/** @deprecated Use isIdeaFirstWorkflowProject or isGenerateWorkflowProject. */
export function isScratchWorkflowProject (project: ProjectWorkflowInput): boolean {
  return isIdeaFirstWorkflowProject(project)
}

export function workflowPathsForProject (
  project: Pick<CreativeProject, 'treatment' | 'workflowMode'> | null | undefined
): readonly string[] {
  if (projectStorySatisfiedByScriptImport(project)) {
    return WORKFLOW_PATHS.filter(p => p !== 'story')
  }
  if (isIdeaFirstWorkflowProject(project)) {
    return WORKFLOW_PATHS.filter(p => p !== 'story')
  }
  return WORKFLOW_PATHS
}

export function workflowStepOf (
  path: string,
  project: Pick<CreativeProject, 'treatment' | 'workflowMode'> | null | undefined
): { current: number; total: number } | null {
  const paths = workflowPathsForProject(project)
  const idx = paths.indexOf(path)
  if (idx < 0) return null
  return { current: idx + 1, total: paths.length }
}

/** Next sidebar step after `current` (e.g. overview → director → characters …). */
export function nextWorkflowPath (
  current: string,
  project: Pick<CreativeProject, 'treatment' | 'workflowMode'> | null | undefined
): WorkflowPath | null {
  const paths = workflowPathsForProject(project)
  const idx = paths.indexOf(current)
  if (idx < 0 || idx >= paths.length - 1) return null
  return paths[idx + 1] as WorkflowPath
}
