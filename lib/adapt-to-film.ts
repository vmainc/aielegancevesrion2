import type {
  AdaptAspectRatio,
  AdaptNarrativeApproach,
  AdaptProductionSummary,
  AdaptScene,
  AdaptSettings,
  AdaptShot,
  AdaptSourceBlock,
  AdaptSourceFidelity,
  AdaptSourceMeta,
  AdaptSourceType,
  AdaptStage,
  AdaptTargetLength,
  AdaptToFilmState,
  AdaptTreatmentContent,
  AdaptType
} from '~/types/adapt-to-film'

export const ADAPT_STAGES: AdaptStage[] = [
  'source',
  'adaptation',
  'treatment',
  'scenes',
  'shots',
  'production'
]

export const ADAPT_STAGE_LABELS: Record<AdaptStage, string> = {
  source: 'Source',
  adaptation: 'Adaptation',
  treatment: 'Treatment',
  scenes: 'Scenes',
  shots: 'Shots',
  production: 'Production Plan'
}

export const ADAPT_SOURCE_TYPES: Array<{ value: AdaptSourceType; label: string }> = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'short_story', label: 'Short story' },
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'article', label: 'Article' },
  { value: 'historical_document', label: 'Historical document' },
  { value: 'original_concept', label: 'Original concept' },
  { value: 'other', label: 'Other' }
]

export const ADAPT_TYPES: Array<{ value: AdaptType; label: string; description: string }> = [
  {
    value: 'faithful',
    label: 'Faithful Adaptation',
    description: 'Stay close to the source structure, events, and wording.'
  },
  {
    value: 'narrated_visual',
    label: 'Narrated Visual Story',
    description: 'Visual scenes driven by voiceover from the source text.'
  },
  {
    value: 'documentary',
    label: 'Documentary',
    description: 'Factual framing with interviews, archival inserts, and narration.'
  },
  {
    value: 'historical_recreation',
    label: 'Historical Recreation',
    description: 'Period-accurate recreation of documented events.'
  },
  {
    value: 'dramatic_recreation',
    label: 'Dramatic Recreation',
    description: 'Dramatize events while preserving core truth.'
  },
  {
    value: 'short_film',
    label: 'Short Film',
    description: 'Compact narrative short suitable for festivals or social.'
  },
  {
    value: 'trailer',
    label: 'Trailer or Teaser',
    description: 'Highlight reel that sells the story without full coverage.'
  },
  {
    value: 'music_video',
    label: 'Music Video',
    description: 'Music-led visual interpretation of the source mood.'
  },
  {
    value: 'experimental',
    label: 'Experimental Film',
    description: 'Non-linear or formal experiment grounded in the source.'
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Define your own adaptation brief in additional instructions.'
  }
]

export const ADAPT_TARGET_LENGTHS: Array<{
  value: AdaptTargetLength
  label: string
  minutes?: number
}> = [
  { value: 'under_1', label: 'Under 1 minute', minutes: 0.75 },
  { value: '1_3', label: '1–3 minutes', minutes: 2 },
  { value: '3_5', label: '3–5 minutes', minutes: 4 },
  { value: '5_10', label: '5–10 minutes', minutes: 7.5 },
  { value: '10_20', label: '10–20 minutes', minutes: 15 },
  { value: 'custom', label: 'Custom' }
]

export const ADAPT_ASPECT_RATIOS: AdaptAspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '2.39:1']

export const ADAPT_VISUAL_STYLE_PRESETS = [
  'Cinematic realism',
  'Documentary',
  'Vintage archival',
  '1940s period film',
  '1950s science fiction',
  'Illustrated storybook',
  'Photorealistic',
  'Noir',
  'Animation',
  'Dreamlike',
  'Custom'
] as const

export const ADAPT_NARRATIVE_APPROACHES: Array<{
  value: AdaptNarrativeApproach
  label: string
}> = [
  { value: 'voiceover', label: 'Voiceover driven' },
  { value: 'dialogue', label: 'Dialogue driven' },
  { value: 'visual', label: 'Visual storytelling' },
  { value: 'mixed', label: 'Mixed narration and dialogue' },
  { value: 'interview', label: 'Interview or documentary format' },
  { value: 'music', label: 'Music driven' }
]

export const ADAPT_FIDELITY_OPTIONS: Array<{
  value: AdaptSourceFidelity
  label: string
  description: string
}> = [
  {
    value: 'strict',
    label: 'Strict',
    description: 'Remain very close to the original wording and events.'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Preserve the source while allowing transitions and visual interpretation.'
  },
  {
    value: 'creative',
    label: 'Creative',
    description: 'Freely adapt the source into a cinematic version.'
  }
]

/** Soft limit before we chunk source into blocks for AI. */
export const ADAPT_LONG_SOURCE_CHARS = 24_000
export const ADAPT_MAX_SOURCE_CHARS = 200_000
export const ADAPT_MIN_SOURCE_CHARS = 40
export const ADAPT_SOURCE_BLOCK_CHARS = 3_500

export const WORKFLOW_ADAPT_MARKER = '<!-- aielegance:workflow=adapt -->'

export function emptyAdaptSettings (): AdaptSettings {
  return {
    adaptationType: 'short_film',
    targetLength: '3_5',
    aspectRatio: '16:9',
    visualStyle: 'Cinematic realism',
    narrativeApproach: 'mixed',
    sourceFidelity: 'balanced',
    additionalInstructions: ''
  }
}

export function emptySourceMeta (): AdaptSourceMeta {
  return {
    sourceTitle: '',
    sourceType: 'other'
  }
}

export function emptyTreatmentContent (): AdaptTreatmentContent {
  return {
    proposedTitle: '',
    alternateTitles: [],
    logline: '',
    shortSynopsis: '',
    fullTreatment: '',
    intendedAudience: '',
    tone: '',
    genre: '',
    visualDirection: '',
    narrativeStructure: '',
    suggestedRuntime: '',
    narratorApproach: '',
    mainCharacters: [],
    primaryLocations: [],
    historicalOrFactualConcerns: '',
    materialRemainVerbatim: '',
    materialNeedsDramatization: '',
    continuityConcerns: '',
    suggestedSceneCount: 0,
    contentWarnings: '',
    adaptationNotes: '',
    sourceFacts: '',
    aiInterpretation: '',
    aiCreatedTransitions: ''
  }
}

export function createEmptyAdaptState (input?: {
  projectTitle?: string
  sourceMeta?: Partial<AdaptSourceMeta>
  originalSourceText?: string
  workingSourceText?: string
  settings?: Partial<AdaptSettings>
}): AdaptToFilmState {
  const original = String(input?.originalSourceText || '')
  const working = String(input?.workingSourceText ?? original)
  return {
    schemaVersion: 1,
    stage: 'source',
    projectTitle: String(input?.projectTitle || 'Untitled Film').slice(0, 200),
    sourceMeta: { ...emptySourceMeta(), ...(input?.sourceMeta || {}) },
    originalSourceText: original,
    workingSourceText: working,
    settings: { ...emptyAdaptSettings(), ...(input?.settings || {}) },
    sourceBlocks: [],
    treatments: [],
    scenes: [],
    shots: [],
    proposedCharacters: [],
    proposedAssets: [],
    checklist: [],
    updatedAt: new Date().toISOString()
  }
}

export function countWords (text: string): number {
  const t = String(text || '').trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

export function validateAdaptSourceText (text: string): string | null {
  const t = String(text || '').trim()
  if (t.length < ADAPT_MIN_SOURCE_CHARS) {
    return `Add at least ${ADAPT_MIN_SOURCE_CHARS} characters of source material before continuing.`
  }
  if (t.length > ADAPT_MAX_SOURCE_CHARS) {
    return `Source text is too large (max ${ADAPT_MAX_SOURCE_CHARS.toLocaleString()} characters). Trim or split the material.`
  }
  return null
}

export function targetRuntimeSeconds (settings: AdaptSettings): number {
  if (settings.targetLength === 'custom') {
    const m = Number(settings.targetMinutesCustom)
    if (Number.isFinite(m) && m > 0) return Math.round(m * 60)
    return 240
  }
  const row = ADAPT_TARGET_LENGTHS.find(x => x.value === settings.targetLength)
  const minutes = row?.minutes ?? 4
  return Math.round(minutes * 60)
}

export function sumSceneDurationSeconds (scenes: AdaptScene[]): number {
  return scenes.reduce((n, s) => n + (Number(s.estimatedDurationSeconds) || 0), 0)
}

export function sumShotDurationSeconds (shots: AdaptShot[]): number {
  return shots.reduce((n, s) => n + (Number(s.estimatedDurationSeconds) || 0), 0)
}

export function durationDeltaLabel (currentSeconds: number, targetSeconds: number): {
  diffSeconds: number
  warning: string | null
} {
  const diff = currentSeconds - targetSeconds
  const abs = Math.abs(diff)
  const threshold = Math.max(30, targetSeconds * 0.25)
  if (abs <= threshold) return { diffSeconds: diff, warning: null }
  if (diff > 0) {
    return {
      diffSeconds: diff,
      warning: `Estimated runtime is about ${Math.round(diff / 60)} min over the target.`
    }
  }
  return {
    diffSeconds: diff,
    warning: `Estimated runtime is about ${Math.round(abs / 60)} min under the target.`
  }
}

/** Split source into ordered blocks with character offsets for traceability. */
export function buildSourceBlocks (text: string, blockSize = ADAPT_SOURCE_BLOCK_CHARS): AdaptSourceBlock[] {
  const raw = String(text || '')
  if (!raw.trim()) return []
  const paragraphs = raw.split(/\n{2,}/)
  const blocks: AdaptSourceBlock[] = []
  let cursor = 0
  let buf = ''
  let bufStart = 0
  let order = 0

  const flush = () => {
    const t = buf.trimEnd()
    if (!t.trim()) {
      buf = ''
      return
    }
    const start = bufStart
    const end = start + t.length
    blocks.push({
      id: `blk_${order + 1}`,
      order: order + 1,
      text: t,
      startChar: start,
      endChar: end
    })
    order += 1
    buf = ''
  }

  for (const para of paragraphs) {
    const slice = para
    const idx = raw.indexOf(slice, cursor)
    const start = idx >= 0 ? idx : cursor
    if (!buf) bufStart = start
    const next = buf ? `${buf}\n\n${slice}` : slice
    if (next.length > blockSize && buf) {
      flush()
      bufStart = start
      buf = slice
    } else {
      buf = next
    }
    cursor = start + slice.length
  }
  flush()
  return blocks
}

export function excerptForRange (text: string, start?: number, end?: number, max = 280): string {
  const t = String(text || '')
  if (typeof start === 'number' && typeof end === 'number' && end > start) {
    return t.slice(start, Math.min(end, start + max)).trim()
  }
  return t.slice(0, max).trim()
}

export function parseAdaptState (raw: unknown): AdaptToFilmState | null {
  if (raw == null) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.schemaVersion !== 1) return null
  const base = createEmptyAdaptState()
  return {
    ...base,
    ...o,
    schemaVersion: 1,
    stage: (ADAPT_STAGES.includes(o.stage as AdaptStage) ? o.stage : 'source') as AdaptStage,
    projectTitle: String(o.projectTitle || base.projectTitle).slice(0, 200),
    sourceMeta: { ...emptySourceMeta(), ...(typeof o.sourceMeta === 'object' && o.sourceMeta ? o.sourceMeta : {}) } as AdaptSourceMeta,
    originalSourceText: String(o.originalSourceText || ''),
    workingSourceText: String(o.workingSourceText || ''),
    settings: { ...emptyAdaptSettings(), ...(typeof o.settings === 'object' && o.settings ? o.settings : {}) } as AdaptSettings,
    sourceBlocks: Array.isArray(o.sourceBlocks) ? (o.sourceBlocks as AdaptSourceBlock[]) : [],
    treatments: Array.isArray(o.treatments) ? (o.treatments as AdaptToFilmState['treatments']) : [],
    approvedTreatmentId: typeof o.approvedTreatmentId === 'string' ? o.approvedTreatmentId : undefined,
    scenes: Array.isArray(o.scenes) ? (o.scenes as AdaptScene[]) : [],
    shots: Array.isArray(o.shots) ? (o.shots as AdaptShot[]) : [],
    proposedCharacters: Array.isArray(o.proposedCharacters)
      ? (o.proposedCharacters as AdaptToFilmState['proposedCharacters'])
      : [],
    proposedAssets: Array.isArray(o.proposedAssets)
      ? (o.proposedAssets as AdaptToFilmState['proposedAssets'])
      : [],
    checklist: Array.isArray(o.checklist) ? (o.checklist as AdaptToFilmState['checklist']) : [],
    longSourceWarning: typeof o.longSourceWarning === 'string' ? o.longSourceWarning : undefined,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString()
  }
}

export function computeProductionSummary (state: AdaptToFilmState): AdaptProductionSummary {
  const scenes = state.scenes
  const shots = state.shots
  const target = targetRuntimeSeconds(state.settings)
  const estimated = sumShotDurationSeconds(shots) || sumSceneDurationSeconds(scenes)
  const continuityWarnings: string[] = []
  for (const s of scenes) {
    if (s.continuityNotes?.trim()) continuityWarnings.push(`Scene ${s.sceneNumber}: ${s.continuityNotes.trim().slice(0, 120)}`)
  }
  const delta = durationDeltaLabel(estimated, target)
  if (delta.warning) continuityWarnings.unshift(delta.warning)

  return {
    totalScenes: scenes.length,
    totalShots: shots.length,
    estimatedRuntimeSeconds: estimated,
    targetRuntimeSeconds: target,
    approvedScenes: scenes.filter(s => s.status === 'approved' || s.status === 'locked').length,
    approvedShots: shots.filter(s => s.status === 'approved' || s.status === 'locked').length,
    shotsNeedingImages: shots.filter(s => !['image_ready', 'video_ready', 'audio_ready', 'approved', 'locked'].includes(s.status)).length,
    shotsNeedingVideo: shots.filter(s => !['video_ready', 'audio_ready', 'approved', 'locked'].includes(s.status)).length,
    shotsNeedingAudio: shots.filter(s => !(s.narration || s.dialogue || s.soundEffects || s.musicDirection)).length,
    missingReferenceAssets: shots.filter(s => (s.referenceAssets || []).length === 0).length,
    continuityWarnings: continuityWarnings.slice(0, 20)
  }
}

export function defaultProductionChecklist (state: AdaptToFilmState): AdaptToFilmState['checklist'] {
  const groups = [
    ['Characters', 'Approve cast descriptions'],
    ['Locations', 'Confirm recurring locations'],
    ['Props', 'List key props and continuity items'],
    ['Reference images', 'Collect reference stills for locked looks'],
    ['Narration', 'Record or generate narration tracks'],
    ['Dialogue', 'Capture dialogue performances'],
    ['Music', 'Score beds and themes'],
    ['Sound effects', 'Foley and ambient beds'],
    ['Image generation', 'Generate starting frames for approved shots'],
    ['Video generation', 'Generate motion clips for approved shots'],
    ['Final editing', 'Assemble timeline and exports']
  ] as const
  return groups.map(([group, label], i) => ({
    id: `chk_${i + 1}`,
    group,
    label,
    done: false
  }))
}

export function reorderByIds<T extends { id: string }> (items: T[], orderedIds: string[]): T[] {
  const map = new Map(items.map(i => [i.id, i]))
  const out: T[] = []
  for (const id of orderedIds) {
    const row = map.get(id)
    if (row) {
      out.push(row)
      map.delete(id)
    }
  }
  for (const row of map.values()) out.push(row)
  return out
}

export function nextStage (stage: AdaptStage): AdaptStage | null {
  const i = ADAPT_STAGES.indexOf(stage)
  if (i < 0 || i >= ADAPT_STAGES.length - 1) return null
  return ADAPT_STAGES[i + 1]
}

export function canEnterStage (state: AdaptToFilmState, stage: AdaptStage): string | null {
  if (stage === 'source') return null
  if (validateAdaptSourceText(state.workingSourceText || state.originalSourceText)) {
    return 'Add meaningful source text before leaving Source.'
  }
  if (stage === 'adaptation') return null
  if (stage === 'treatment') return null
  if (['scenes', 'shots', 'production'].includes(stage)) {
    const approved = state.treatments.find(t => t.id === state.approvedTreatmentId && t.approved)
    if (!approved && !state.treatments.some(t => t.approved)) {
      return 'Approve a treatment before opening later stages.'
    }
  }
  if (stage === 'shots' || stage === 'production') {
    if (!state.scenes.length) return 'Generate scenes before opening Shots or Production Plan.'
  }
  return null
}

export function resolveAdaptVisualStyle (settings: AdaptSettings): string {
  if (settings.visualStyle === 'Custom' || !settings.visualStyle) {
    return String(settings.visualStyleCustom || '').trim() || 'Cinematic realism'
  }
  return settings.visualStyle
}

export function resolveAdaptTypeLabel (settings: AdaptSettings): string {
  if (settings.adaptationType === 'custom') {
    return String(settings.adaptationTypeCustom || '').trim() || 'Custom'
  }
  return ADAPT_TYPES.find(t => t.value === settings.adaptationType)?.label || settings.adaptationType
}

/** Delimiters for untrusted source text in AI prompts. */
export const ADAPT_SOURCE_START = '<<<SOURCE_MATERIAL>>>'
export const ADAPT_SOURCE_END = '<<<END_SOURCE_MATERIAL>>>'

/** Wrap source text so models treat it as data, not instructions. */
export function buildSourceDelimitedBlock (text: string): string {
  return `${ADAPT_SOURCE_START}\n${String(text || '')}\n${ADAPT_SOURCE_END}`
}

/** Scenes that bulk regeneration may overwrite. */
export function filterUnlockedScenes (scenes: AdaptScene[]): AdaptScene[] {
  return scenes.filter(s => !s.locked && s.status !== 'locked')
}

/** Shots that bulk regeneration may overwrite. */
export function filterUnlockedShots (shots: AdaptShot[]): AdaptShot[] {
  return shots.filter(s => !s.locked && s.status !== 'locked')
}
