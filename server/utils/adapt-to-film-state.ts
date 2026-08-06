import type PocketBase from 'pocketbase'
import {
  createEmptyAdaptState,
  parseAdaptState
} from '~/lib/adapt-to-film'
import type { AdaptToFilmState } from '~/types/adapt-to-film'
import {
  formatPocketBaseRecordError,
  pocketBaseErrorMessage
} from '~/server/utils/pb-missing-collection-error'

function isAdaptFieldMissingError (e: unknown): boolean {
  const msg = pocketBaseErrorMessage(e).toLowerCase()
  return (
    msg.includes('adapt_to_film') ||
    msg.includes('unknown field') ||
    msg.includes('unknown column') ||
    msg.includes('validation_unknown_keys') ||
    msg.includes('field not found')
  )
}

/** Read AdaptToFilmState from a creative_projects row; empty state if missing. */
export function readAdaptStateFromProjectRow (row: Record<string, unknown>): AdaptToFilmState {
  const parsed = parseAdaptState(row.adapt_to_film)
  if (parsed) return parsed
  const name = String(row.name || '').trim()
  const synopsis = String(row.synopsis || '').trim()
  return createEmptyAdaptState({
    projectTitle: name || undefined,
    originalSourceText: synopsis || undefined,
    workingSourceText: synopsis || undefined
  })
}

/** PocketBase update payload derived from Adapt state. */
export function adaptStateToPbPayload (state: AdaptToFilmState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    adapt_to_film: state
  }
  const title = String(state.projectTitle || '').trim()
  if (title) payload.name = title.slice(0, 500)

  // PocketBase creative_projects currently allows 16:9 | 9:16 | 1:1 only.
  const ar = state.settings?.aspectRatio
  if (ar === '16:9' || ar === '9:16' || ar === '1:1') {
    payload.aspect_ratio = ar
  }

  const approved =
    state.treatments.find(t => t.id === state.approvedTreatmentId && t.approved) ||
    state.treatments.find(t => t.approved) ||
    (state.approvedTreatmentId
      ? state.treatments.find(t => t.id === state.approvedTreatmentId)
      : undefined)
  const treatmentText = approved?.content?.fullTreatment?.trim()
  if (treatmentText) {
    payload.treatment = treatmentText.slice(0, 100_000)
  }

  return payload
}

export async function loadAdaptState (
  pb: PocketBase,
  projectId: string
): Promise<{ row: Record<string, unknown>; state: AdaptToFilmState }> {
  const row = (await pb.collection('creative_projects').getOne(projectId)) as Record<string, unknown>
  return { row, state: readAdaptStateFromProjectRow(row) }
}

export async function saveAdaptState (
  pb: PocketBase,
  projectId: string,
  state: AdaptToFilmState
): Promise<AdaptToFilmState> {
  const next: AdaptToFilmState = {
    ...state,
    updatedAt: new Date().toISOString()
  }
  const payload = adaptStateToPbPayload(next)
  try {
    await pb.collection('creative_projects').update(projectId, payload)
  } catch (e: unknown) {
    if (isAdaptFieldMissingError(e)) {
      throw new Error(
        'creative_projects.adapt_to_film field is missing. Run: npm run add-fields'
      )
    }
    const detail = formatPocketBaseRecordError(e)
    throw new Error(detail || 'Could not save Adapt to Film state.')
  }
  return next
}
