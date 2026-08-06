/** Adapt to Film — structured film-development workflow types. */

export type AdaptStage =
  | 'source'
  | 'adaptation'
  | 'treatment'
  | 'scenes'
  | 'shots'
  | 'production'

export type AdaptSourceType =
  | 'transcript'
  | 'short_story'
  | 'screenplay'
  | 'article'
  | 'historical_document'
  | 'original_concept'
  | 'other'

export type AdaptType =
  | 'faithful'
  | 'narrated_visual'
  | 'documentary'
  | 'historical_recreation'
  | 'dramatic_recreation'
  | 'short_film'
  | 'trailer'
  | 'music_video'
  | 'experimental'
  | 'custom'

export type AdaptTargetLength =
  | 'under_1'
  | '1_3'
  | '3_5'
  | '5_10'
  | '10_20'
  | 'custom'

export type AdaptAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '2.39:1'

export type AdaptNarrativeApproach =
  | 'voiceover'
  | 'dialogue'
  | 'visual'
  | 'mixed'
  | 'interview'
  | 'music'

export type AdaptSourceFidelity = 'strict' | 'balanced' | 'creative'

export type AdaptSceneStatus = 'draft' | 'needs_review' | 'approved' | 'locked'

export type AdaptShotStatus =
  | 'planned'
  | 'prompt_ready'
  | 'image_ready'
  | 'video_ready'
  | 'audio_ready'
  | 'needs_revision'
  | 'approved'
  | 'locked'

export type AdaptSourceFidelityClass =
  | 'directly_sourced'
  | 'lightly_adapted'
  | 'ai_created_transition'
  | 'dramatic_interpretation'

export type AdaptJobKind =
  | 'analyze_source'
  | 'treatment'
  | 'treatment_section'
  | 'scenes'
  | 'scene'
  | 'shots'
  | 'shot'
  | 'shot_prompt'
  | 'extract_characters'
  | 'extract_assets'

export type AdaptJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type AdaptSourceMeta = {
  sourceTitle: string
  sourceType: AdaptSourceType
  originalFilename?: string
  originalAudioFilename?: string
  sourceDate?: string
  sourceAuthor?: string
  sourceNotes?: string
  speechToTextJobId?: string
}

export type AdaptSettings = {
  adaptationType: AdaptType
  adaptationTypeCustom?: string
  targetLength: AdaptTargetLength
  targetMinutesCustom?: number
  aspectRatio: AdaptAspectRatio
  visualStyle: string
  visualStyleCustom?: string
  narrativeApproach: AdaptNarrativeApproach
  sourceFidelity: AdaptSourceFidelity
  additionalInstructions: string
}

export type AdaptSourceBlock = {
  id: string
  order: number
  text: string
  startChar: number
  endChar: number
  summary?: string
}

export type AdaptSourceRef = {
  blockId?: string
  startChar?: number
  endChar?: number
  excerpt: string
}

export type AdaptTreatmentContent = {
  proposedTitle: string
  alternateTitles: string[]
  logline: string
  shortSynopsis: string
  fullTreatment: string
  intendedAudience: string
  tone: string
  genre: string
  visualDirection: string
  narrativeStructure: string
  suggestedRuntime: string
  narratorApproach: string
  mainCharacters: Array<{ name: string; role: string; notes: string }>
  primaryLocations: string[]
  historicalOrFactualConcerns: string
  materialRemainVerbatim: string
  materialNeedsDramatization: string
  continuityConcerns: string
  suggestedSceneCount: number
  contentWarnings: string
  adaptationNotes: string
  sourceFacts: string
  aiInterpretation: string
  aiCreatedTransitions: string
}

export type AdaptTreatmentVersion = {
  id: string
  version: number
  createdAt: string
  approved: boolean
  content: AdaptTreatmentContent
  source: 'ai' | 'user'
}

export type AdaptSceneData = {
  sceneNumber: number
  title: string
  purpose: string
  sourceRefs: AdaptSourceRef[]
  location: string
  timeOfDay: string
  historicalPeriod: string
  characters: string[]
  summary: string
  visualDescription: string
  narration: string
  dialogue: string
  estimatedDurationSeconds: number
  emotionalTone: string
  transitionIn: string
  transitionOut: string
  requiredAssets: string[]
  historicalNotes: string
  continuityNotes: string
  sourceFidelity: AdaptSourceFidelityClass
  status: AdaptSceneStatus
  locked: boolean
}

export type AdaptScene = AdaptSceneData & {
  id: string
  /** Linked creative_scenes row when synced. */
  creativeSceneId?: string
}

export type AdaptShotData = {
  shotNumber: number
  sceneNumber: number
  title: string
  shotType: string
  visualDescription: string
  startingFrameDescription: string
  imagePrompt: string
  videoPrompt: string
  endingFrameDescription: string
  cameraFraming: string
  cameraMovement: string
  lensOrPerspective: string
  subjectAction: string
  characterExpression: string
  environmentDetails: string
  lighting: string
  colorAndAtmosphere: string
  estimatedDurationSeconds: number
  narration: string
  dialogue: string
  soundEffects: string
  musicDirection: string
  transition: string
  continuityRequirements: string
  referenceAssets: string[]
  negativePrompt: string
  generationNotes: string
  status: AdaptShotStatus
  locked: boolean
}

export type AdaptShot = AdaptShotData & {
  id: string
  sceneId: string
  creativeShotId?: string
}

export type AdaptProposedCharacter = {
  id: string
  name: string
  role: string
  descriptionFromSource: string
  aiInterpretation: string
  ageRange: string
  physicalAppearance: string
  wardrobe: string
  historicalPeriod: string
  personality: string
  continuityRequirements: string
  sourceRefs: AdaptSourceRef[]
  representsRealPerson: boolean
  knownVsInferredNotes: string
  approved: boolean
  linkedCharacterId?: string
}

export type AdaptProposedAsset = {
  id: string
  name: string
  type: string
  description: string
  sourceRefs: AdaptSourceRef[]
  continuityNotes: string
  approved: boolean
}

export type AdaptChecklistItem = {
  id: string
  group: string
  label: string
  done: boolean
}

export type AdaptProductionSummary = {
  totalScenes: number
  totalShots: number
  estimatedRuntimeSeconds: number
  targetRuntimeSeconds: number
  approvedScenes: number
  approvedShots: number
  shotsNeedingImages: number
  shotsNeedingVideo: number
  shotsNeedingAudio: number
  missingReferenceAssets: number
  continuityWarnings: string[]
}

/** Full Adapt to Film document stored on the project (`adapt_to_film` JSON). */
export type AdaptToFilmState = {
  schemaVersion: 1
  stage: AdaptStage
  projectTitle: string
  sourceMeta: AdaptSourceMeta
  originalSourceText: string
  workingSourceText: string
  settings: AdaptSettings
  sourceBlocks: AdaptSourceBlock[]
  longSourceWarning?: string
  treatments: AdaptTreatmentVersion[]
  approvedTreatmentId?: string
  scenes: AdaptScene[]
  shots: AdaptShot[]
  proposedCharacters: AdaptProposedCharacter[]
  proposedAssets: AdaptProposedAsset[]
  checklist: AdaptChecklistItem[]
  updatedAt: string
}
