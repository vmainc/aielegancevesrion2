import type { CreativeProject, ProjectWorkflowMode } from '~/types/creative-project'

/** Embedded in `concept_notes` when PocketBase has no `workflow_mode` field yet. */
export const WORKFLOW_SCRATCH_MARKER = '<!-- aielegance:workflow=scratch -->'

const SESSION_PREFIX = 'aielegance-wf:'

export function workflowModeFromProjectRecord (r: {
  workflow_mode?: string
  concept_notes?: string
}): ProjectWorkflowMode {
  if (r.workflow_mode === 'scratch') return 'scratch'
  if (r.workflow_mode === 'import') return 'import'
  if (String(r.concept_notes || '').includes(WORKFLOW_SCRATCH_MARKER)) return 'scratch'
  return 'import'
}

export function stripWorkflowMarker (text: string): string {
  return text
    .replace(WORKFLOW_SCRATCH_MARKER, '')
    .replace(/^\s*\n/, '')
    .trimStart()
}

export function initialConceptNotesForWorkflow (mode: ProjectWorkflowMode): string {
  return mode === 'scratch' ? `${WORKFLOW_SCRATCH_MARKER}\n` : ''
}

export function sessionWorkflowKey (projectId: string): string {
  return `${SESSION_PREFIX}${projectId}`
}

export function readSessionWorkflow (projectId: string): ProjectWorkflowMode | null {
  if (!import.meta.client) return null
  try {
    const v = sessionStorage.getItem(sessionWorkflowKey(projectId))
    return v === 'scratch' || v === 'import' ? v : null
  } catch {
    return null
  }
}

export function writeSessionWorkflow (projectId: string, mode: ProjectWorkflowMode): void {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(sessionWorkflowKey(projectId), mode)
  } catch {
    /* ignore quota */
  }
}

/** Prefer explicit PB field, then notes marker, then session overlay from create/settings. */
export function resolveProjectWorkflowMode (
  project: Pick<CreativeProject, 'id' | 'workflowMode' | 'conceptNotes'>
): ProjectWorkflowMode {
  if (project.workflowMode === 'scratch') return 'scratch'
  if (String(project.conceptNotes || '').includes(WORKFLOW_SCRATCH_MARKER)) return 'scratch'
  const session = readSessionWorkflow(project.id)
  if (session) return session
  return 'import'
}

export function applyClientWorkflowOverlay (p: CreativeProject): CreativeProject {
  const mode = resolveProjectWorkflowMode(p)
  if (mode === p.workflowMode) return p
  return { ...p, workflowMode: mode }
}
