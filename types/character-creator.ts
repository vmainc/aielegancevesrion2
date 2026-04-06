/** One image result from Character Creator (API + UI). */
export interface CharacterCreatorImageResult {
  model: string
  image_url: string | null
  prompt_used: string
  error?: string
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
