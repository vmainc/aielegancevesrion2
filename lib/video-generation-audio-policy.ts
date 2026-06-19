/** Appended to silent video prompts so models do not invent inconsistent scores. */
export const VIDEO_NO_BACKGROUND_MUSIC_BLOCK = `AUDIO POLICY — NO SCORE OR MUSIC:
No background music, score, soundtrack, or musical underscore.
No songs or licensed-style beds.
Ambient diegetic sound only if needed (wind, room tone, footsteps).
No spoken dialogue unless explicitly written in the prompt above.
Music and score are added later on the project timeline — visuals and motion only.`

/** When generate_audio is on: speech in clip, still no score. */
export const VIDEO_SPOKEN_DIALOGUE_POLICY_BLOCK = `AUDIO POLICY — SPOKEN DIALOGUE:
Include clear, audible spoken dialogue exactly as described in the prompt (when dialogue lines are given).
Lip movement should match speech when a face is visible.
No background music, score, soundtrack, or musical underscore.
Ambient diegetic sound optional (room tone, wind).`

export function promptAlreadyHasAudioPolicy (prompt: string): boolean {
  return /AUDIO POLICY — NO SCORE|AUDIO POLICY — SPOKEN|no background music|no soundtrack/i.test(prompt)
}

/** Ensure every silent video generation request carries the no-music directive (idempotent). */
export function applyVideoNoBackgroundMusicPolicy (prompt: string): string {
  const base = prompt.trim()
  if (!base) return base
  if (promptAlreadyHasAudioPolicy(base)) return base
  return `${base}\n\n${VIDEO_NO_BACKGROUND_MUSIC_BLOCK}`
}

/** Pick prompt suffix from whether the job requests synthesized speech. */
export function applyVideoGenerationPromptPolicy (
  prompt: string,
  includeSpokenDialogue: boolean
): string {
  const base = prompt.trim()
  if (!base) return base
  if (promptAlreadyHasAudioPolicy(base)) return base
  return `${base}\n\n${includeSpokenDialogue ? VIDEO_SPOKEN_DIALOGUE_POLICY_BLOCK : VIDEO_NO_BACKGROUND_MUSIC_BLOCK}`
}

/** Append an explicit line for the model to speak (shown in UI + sent to API). */
export function appendSpokenDialogueLine (prompt: string, dialogueLine: string): string {
  const base = prompt.trim()
  const line = dialogueLine.trim()
  if (!line) return base
  const block = `SPOKEN DIALOGUE (must be clearly audible in the clip):\n"${line}"`
  if (base.includes(line)) return base
  return base ? `${base}\n\n${block}` : block
}

/** Client/server: merge user prompt + optional dialogue field before API call. */
export function resolveVideoGenerationPrompt (opts: {
  prompt: string
  dialogueLine?: string
  includeSpokenDialogue?: boolean
}): string {
  let out = opts.prompt.trim()
  if (opts.includeSpokenDialogue && opts.dialogueLine?.trim()) {
    out = appendSpokenDialogueLine(out, opts.dialogueLine)
  }
  return out
}

/** OpenRouter video jobs: only synthesize audio when explicitly opted in. */
export function openRouterWantsGeneratedVideoAudio (explicit?: unknown): boolean {
  return explicit === true || explicit === 'true'
}
