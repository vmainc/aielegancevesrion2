/** One image result from Character Creator (API + UI). */
export interface CharacterCreatorImageResult {
  model: string
  image_url: string | null
  prompt_used: string
  error?: string
  /** Present on the first result when project-scoped bible context was resolved. */
  productionBibleDebug?: import('~/lib/production-bible-generation-context').ProductionBibleGenerationDebug
}

/** Stored locally for future project / storyboard hooks. */
export interface CharacterLibraryEntry {
  model: string
  modelLabel: string
  image_url: string
  prompt_used: string
  characterName: string
  savedAt: string
}
