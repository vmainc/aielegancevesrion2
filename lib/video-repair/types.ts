import type { RepairCategoryId } from './categories'

/** User-facing repair strength. Never expose provider mode names in the UI. */
export const REPAIR_MODE_IDS = ['preserve', 'balanced', 'reimagine'] as const
export type RepairMode = (typeof REPAIR_MODE_IDS)[number]

export const REPAIR_ENGINE_IDS = ['auto', 'openrouter', 'luma'] as const
export type RepairEngineChoice = (typeof REPAIR_ENGINE_IDS)[number]

export type VideoRepairProviderId = 'openrouter' | 'luma'

export const VIDEO_REPAIR_JOB_STATUSES = [
  'queued',
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired'
] as const
export type VideoRepairJobStatus = (typeof VIDEO_REPAIR_JOB_STATUSES)[number]

export type VideoRepairReferenceFrame = {
  /** Public or staged URL the engine can fetch. */
  url: string
  /** Seconds into the source clip when extracted from a scrubber. */
  timestampSeconds?: number
  source: 'extracted_frame' | 'upload' | 'character'
}

export type VideoRepairPromptContext = {
  categories: RepairCategoryId[]
  userDescription: string
  repairMode: RepairMode
  hasReferenceFrame: boolean
  /** Model id that generated the source clip (e.g. bytedance/seedance-2.0). */
  sourceGenerationModel?: string
  characterName?: string
  characterAppearance?: string
  characterNotes?: string
  sceneHeading?: string
  sceneSummary?: string
  shotTitle?: string
  shotDescription?: string
  shotType?: string
  cameraMove?: string
}

export type VideoRepairRequest = {
  sourceVideoUrl: string
  prompt: string
  referenceFrames: VideoRepairReferenceFrame[]
  repairMode: RepairMode
  durationSeconds?: number
  provider: VideoRepairProviderId
  model: string
  aspectRatio?: string
}

export type VideoRepairJob = {
  id: string
  provider: VideoRepairProviderId
  model: string
  status: VideoRepairJobStatus
  sourceVideo: string
  outputVideo: string | null
  createdAt: string
  completedAt: string | null
  error: string | null
  /** Estimated USD from duration × catalog rate. */
  estimatedCost: number | null
  /** Provider-reported USD when available. */
  actualCost: number | null
  durationSeconds: number | null
}

export function isRepairMode (v: unknown): v is RepairMode {
  return typeof v === 'string' && (REPAIR_MODE_IDS as readonly string[]).includes(v)
}

export function isRepairEngineChoice (v: unknown): v is RepairEngineChoice {
  return typeof v === 'string' && (REPAIR_ENGINE_IDS as readonly string[]).includes(v)
}

export function parseRepairMode (v: unknown, fallback: RepairMode = 'balanced'): RepairMode {
  return isRepairMode(v) ? v : fallback
}

/** Categories where Aleph often no-ops unless correction strength is high. */
const STRONG_REPAIR_CATEGORY_IDS: ReadonlySet<RepairCategoryId> = new Set([
  'face_eyes',
  'character_consistency',
  'lip_sync'
])

/** Filmmaker text that implies a face/eye correction even without a category chip. */
const FACE_EYE_REPAIR_HINT =
  /\b(eyes?|eye[\s-]?colo(?:u)?r|irises?|pupils?|facial|eyelids?|eyebrows?|eye[\s-]?size|eye[\s-]?shape|face\s+proportions?)\b/i

/**
 * Face/eye (and related identity) fixes tend to look unchanged under preserve/balanced.
 * Detect those so we can bump to a stronger correction automatically.
 */
export function needsStrongRepairCorrection (
  categories: RepairCategoryId[],
  userDescription: string
): boolean {
  if (categories.some(id => STRONG_REPAIR_CATEGORY_IDS.has(id))) return true
  return FACE_EYE_REPAIR_HINT.test(userDescription || '')
}

/**
 * Effective mode sent to the repair engine. Face/eye work always gets reimagine
 * unless the caller already asked for it.
 */
export function resolveEffectiveRepairMode (
  mode: RepairMode,
  categories: RepairCategoryId[],
  userDescription: string
): RepairMode {
  if (mode === 'reimagine') return 'reimagine'
  if (needsStrongRepairCorrection(categories, userDescription)) return 'reimagine'
  return mode
}

export function parseRepairEngineChoice (v: unknown, fallback: RepairEngineChoice = 'auto'): RepairEngineChoice {
  return isRepairEngineChoice(v) ? v : fallback
}

export const REPAIR_MODE_LABELS: Record<RepairMode, { label: string; hint: string }> = {
  preserve: {
    label: 'Preserve',
    hint: 'Smallest possible correction. Stay extremely close to the original shot.'
  },
  balanced: {
    label: 'Balanced',
    hint: 'Fix the problem while keeping camera, motion and composition.'
  },
  reimagine: {
    label: 'Reimagine',
    hint: 'Stronger correction. May restyle the identified issue more freely.'
  }
}

export const REPAIR_ENGINE_LABELS: Record<RepairEngineChoice, string> = {
  auto: 'Auto',
  openrouter: 'Runway Aleph',
  luma: 'Luma Modify'
}
