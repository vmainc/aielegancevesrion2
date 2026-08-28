import type { RepairCategoryId } from '~/lib/video-repair/categories'

export const SHOT_ANALYSIS_TYPES = [
  'face_consistency',
  'character_identity_drift',
  'eye_facial_anomalies',
  'skin_tone_consistency',
  'hair_consistency',
  'wardrobe_consistency',
  'animal_consistency',
  'object_continuity',
  'background_continuity',
  'lighting_shifts',
  'temporal_artifacts',
  'lip_sync',
  'audio_voice_consistency'
] as const

export type ShotAnalysisType = (typeof SHOT_ANALYSIS_TYPES)[number]

export type ShotAnalysisSeverity = 'low' | 'medium' | 'high'

export type ShotAnalysisFinding = {
  type: ShotAnalysisType
  severity: ShotAnalysisSeverity
  startTime: number
  endTime: number
  description: string
  confidence: number
  /** Maps to a Fix Shot category when the user clicks FIX. */
  repairCategory?: RepairCategoryId
}

export const ANALYSIS_TYPE_TO_CATEGORY: Partial<Record<ShotAnalysisType, RepairCategoryId>> = {
  face_consistency: 'face_eyes',
  character_identity_drift: 'character_consistency',
  eye_facial_anomalies: 'face_eyes',
  skin_tone_consistency: 'skin_tone',
  hair_consistency: 'hair',
  wardrobe_consistency: 'clothing',
  animal_consistency: 'animal_creature',
  object_continuity: 'object_prop',
  background_continuity: 'background',
  lighting_shifts: 'lighting_color',
  temporal_artifacts: 'other',
  lip_sync: 'lip_sync',
  audio_voice_consistency: 'voice'
}

export type ShotAnalysisResult = {
  experimental: true
  findings: ShotAnalysisFinding[]
  summary: string
  model?: string
}
