/** Appended to video prompts so models do not invent inconsistent scores. */
export const VIDEO_NO_BACKGROUND_MUSIC_BLOCK = `AUDIO POLICY — NO SCORE OR MUSIC:
No background music, score, soundtrack, or musical underscore.
No songs or licensed-style beds.
Ambient diegetic sound only if needed (wind, room tone, footsteps).
Dialogue only when explicitly requested for this shot.
Music and score are added later on the project timeline — visuals and motion only.`

export function promptAlreadyHasNoMusicPolicy (prompt: string): boolean {
  return /AUDIO POLICY — NO SCORE|no background music|no soundtrack/i.test(prompt)
}

/** Ensure every video generation request carries the no-music directive (idempotent). */
export function applyVideoNoBackgroundMusicPolicy (prompt: string): string {
  const base = prompt.trim()
  if (!base) return base
  if (promptAlreadyHasNoMusicPolicy(base)) return base
  return `${base}\n\n${VIDEO_NO_BACKGROUND_MUSIC_BLOCK}`
}

/** OpenRouter video jobs: only synthesize audio when explicitly opted in. */
export function openRouterWantsGeneratedVideoAudio (explicit?: unknown): boolean {
  return explicit === true || explicit === 'true'
}
