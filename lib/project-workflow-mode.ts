import type { CreativeProject, ProjectWorkflowMode } from '~/types/creative-project'

/** Embedded in `concept_notes` when PocketBase has no `workflow_mode` field yet. */
export const WORKFLOW_IDEA_MARKER = '<!-- aielegance:workflow=idea -->'
export const WORKFLOW_GENERATE_MARKER = '<!-- aielegance:workflow=generate -->'
/** Legacy marker — treated as `generate`. */
export const WORKFLOW_SCRATCH_MARKER = '<!-- aielegance:workflow=scratch -->'

const ALL_MARKERS = [WORKFLOW_IDEA_MARKER, WORKFLOW_GENERATE_MARKER, WORKFLOW_SCRATCH_MARKER]

const SESSION_PREFIX = 'aielegance-wf:'

export function normalizeWorkflowMode (raw: string | undefined | null): ProjectWorkflowMode | null {
  if (raw === 'import' || raw === 'idea' || raw === 'generate') return raw
  if (raw === 'scratch') return 'generate'
  return null
}

export function workflowModeFromProjectRecord (r: {
  workflow_mode?: string
  concept_notes?: string
}): ProjectWorkflowMode {
  const notes = String(r.concept_notes || '')
  if (notes.includes(WORKFLOW_IDEA_MARKER)) return 'idea'
  if (notes.includes(WORKFLOW_GENERATE_MARKER) || notes.includes(WORKFLOW_SCRATCH_MARKER)) return 'generate'
  const fromField = normalizeWorkflowMode(r.workflow_mode)
  if (fromField) return fromField
  return 'import'
}

export function stripWorkflowMarker (text: string): string {
  let out = text
  for (const marker of ALL_MARKERS) {
    out = out.replace(marker, '')
  }
  return out.replace(/^\s*\n/, '').trimStart()
}

export function initialConceptNotesForWorkflow (mode: ProjectWorkflowMode): string {
  if (mode === 'idea') return `${WORKFLOW_IDEA_MARKER}\n`
  if (mode === 'generate') return `${WORKFLOW_GENERATE_MARKER}\n`
  return ''
}

/** PocketBase select before `idea` / `generate` were provisioned (import | scratch only). */
export function legacyPbWorkflowMode (mode: ProjectWorkflowMode): 'import' | 'scratch' {
  return mode === 'generate' ? 'scratch' : 'import'
}

export function sessionWorkflowKey (projectId: string): string {
  return `${SESSION_PREFIX}${projectId}`
}

export function readSessionWorkflow (projectId: string): ProjectWorkflowMode | null {
  if (!import.meta.client) return null
  try {
    const v = sessionStorage.getItem(sessionWorkflowKey(projectId))
    return normalizeWorkflowMode(v)
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
  const notes = String(project.conceptNotes || '')
  if (notes.includes(WORKFLOW_IDEA_MARKER)) return 'idea'
  if (notes.includes(WORKFLOW_GENERATE_MARKER) || notes.includes(WORKFLOW_SCRATCH_MARKER)) return 'generate'
  const session = readSessionWorkflow(project.id)
  if (session) return session
  const fromProject = normalizeWorkflowMode(project.workflowMode)
  if (fromProject) return fromProject
  return 'import'
}

export function applyClientWorkflowOverlay (p: CreativeProject): CreativeProject {
  const mode = resolveProjectWorkflowMode(p)
  if (mode === p.workflowMode) return p
  return { ...p, workflowMode: mode }
}
