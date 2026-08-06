import type { CreativeProject, ProjectWorkflowMode } from '~/types/creative-project'
import { resolveProjectWorkflowMode } from '~/lib/project-workflow-mode'

/** Present in `treatment` after full script import AI (see `enrichmentToProjectFields`). */
export const IMPORTED_SCRIPT_TREATMENT_MARKER = 'Script analysis (cold read)'

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
  'characters',
  'director',
  'scenes',
  'storyboard',
  'video'
] as const

const ADAPT_WORKFLOW_PATHS = [
  'adapt',
  'home',
  'overview',
  'characters',
  'director',
  'scenes',
  'storyboard',
  'video'
] as const

export type WorkflowPath = (typeof WORKFLOW_PATHS)[number] | 'adapt'

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

/** Idea-first projects (own idea or AI-generated). */
export function isIdeaFirstWorkflowProject (project: ProjectWorkflowInput): boolean {
  const mode = projectWorkflowMode(project)
  return mode === 'idea' || mode === 'generate'
}

/** @deprecated Use isIdeaFirstWorkflowProject or isGenerateWorkflowProject. */
export function isScratchWorkflowProject (project: ProjectWorkflowInput): boolean {
  return isIdeaFirstWorkflowProject(project)
}

export function isAdaptWorkflowProject (project: ProjectWorkflowInput): boolean {
  return projectWorkflowMode(project) === 'adapt'
}

export function workflowPathsForProject (
  project: Pick<CreativeProject, 'treatment' | 'workflowMode' | 'conceptNotes' | 'id'> | null | undefined
): readonly string[] {
  if (project && isAdaptWorkflowProject(project)) return ADAPT_WORKFLOW_PATHS
  return WORKFLOW_PATHS
}

export function workflowStepOf (
  path: string,
  project: Pick<CreativeProject, 'treatment' | 'workflowMode' | 'conceptNotes' | 'id'> | null | undefined
): { current: number; total: number } | null {
  const paths = workflowPathsForProject(project)
  const idx = paths.indexOf(path)
  if (idx < 0) return null
  return { current: idx + 1, total: paths.length }
}

/** Next sidebar step after `current` (e.g. overview → characters → director …). */
export function nextWorkflowPath (
  current: string,
  project: Pick<CreativeProject, 'treatment' | 'workflowMode' | 'conceptNotes' | 'id'> | null | undefined
): WorkflowPath | null {
  const paths = workflowPathsForProject(project)
  const idx = paths.indexOf(current)
  if (idx < 0 || idx >= paths.length - 1) return null
  return paths[idx + 1] as WorkflowPath
}

/** Where to send the user right after creating a project. */
export function projectCreateLandingPath (
  projectId: string,
  mode: ProjectWorkflowMode
): string {
  if (mode === 'adapt') return `/projects/${projectId}/adapt`
  if (mode === 'import' || mode === 'idea' || mode === 'generate') {
    return `/projects/${projectId}/overview`
  }
  return `/projects/${projectId}/guide`
}

/** Where to send the user when opening an existing project. */
export function projectOpenLandingPath (projectId: string): string {
  return `/projects/${projectId}/guide`
}
