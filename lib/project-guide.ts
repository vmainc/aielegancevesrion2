/** Shared types for the project-scoped AI guide (client + server). */

export type GuideSuggestionTarget = 'project' | 'character' | 'director'

export type GuideSuggestion = {
  id: string
  target: GuideSuggestionTarget
  field: string
  value: string
  label: string
  rationale: string
  characterId?: string
  characterName?: string
}

export type GuideChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestions?: GuideSuggestion[]
  createdAt: string
}

export const PROJECT_GUIDE_STORAGE_PREFIX = 'aielegance-project-guide-'

export function guideStorageKey (projectId: string): string {
  return `${PROJECT_GUIDE_STORAGE_PREFIX}${projectId}`
}

export function loadGuideMessages (projectId: string): GuideChatMessage[] {
  if (typeof localStorage === 'undefined' || !projectId) return []
  try {
    const raw = localStorage.getItem(guideStorageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is GuideChatMessage =>
        m &&
        typeof m === 'object' &&
        typeof (m as GuideChatMessage).id === 'string' &&
        ((m as GuideChatMessage).role === 'user' || (m as GuideChatMessage).role === 'assistant') &&
        typeof (m as GuideChatMessage).content === 'string'
    )
  } catch {
    return []
  }
}

export function saveGuideMessages (projectId: string, messages: GuideChatMessage[]): void {
  if (typeof localStorage === 'undefined' || !projectId) return
  try {
    localStorage.setItem(guideStorageKey(projectId), JSON.stringify(messages.slice(-80)))
  } catch {
    /* quota / private mode */
  }
}

export function newGuideMessageId (): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Human labels for suggestion cards. */
export const GUIDE_FIELD_LABELS: Record<string, string> = {
  synopsis: 'Synopsis',
  treatment: 'Treatment',
  conceptNotes: 'Concept notes',
  genre: 'Genre',
  tone: 'Tone',
  continuityMemory: 'Continuity memory',
  'director.style': 'Director · Visual style',
  'director.tone': 'Director · Tone',
  'director.camera_preferences': 'Director · Camera',
  'director.lighting_style': 'Director · Lighting',
  'director.pacing': 'Director · Pacing',
  roleDescription: 'Role / look prompt',
  appearanceDescription: 'Appearance',
  personality: 'Personality',
  voiceDescription: 'Voice notes',
  signatureDetails: 'Signature details',
  avoidDescription: 'Avoid / never show'
}
