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
Ambient diegetic sound optional (room tone, wind) when described in the prompt.`

/** Diegetic ambient / environmental sound only — no score. */
export const VIDEO_AMBIENT_SOUND_POLICY_BLOCK = `AUDIO POLICY — AMBIENT SOUND:
Include clear diegetic ambient and environmental sound exactly as described in the prompt (room tone, nature, hallway echo, traffic, etc.).
Sound must feel in-scene and realistic — not a musical score or soundtrack bed.
No background music, score, soundtrack, or musical underscore.
No spoken dialogue unless explicitly written in the prompt above.`

/** Dialogue + ambient both requested. */
export const VIDEO_COMBINED_AUDIO_POLICY_BLOCK = `AUDIO POLICY — DIALOGUE AND AMBIENT SOUND:
Include clear spoken dialogue when dialogue lines are given in the prompt; lip movement should match when a face is visible.
Include diegetic ambient and environmental sound when described in the prompt (room tone, nature, hallway, etc.).
No background music, score, soundtrack, or musical underscore.`

export type VideoGenerationAudioOptions = {
  includeSpokenDialogue?: boolean
  includeAmbientSound?: boolean
}

export function promptAlreadyHasAudioPolicy (prompt: string): boolean {
  return /AUDIO POLICY — NO SCORE|AUDIO POLICY — SPOKEN|AUDIO POLICY — AMBIENT|AUDIO POLICY — DIALOGUE|no background music|no soundtrack/i.test(prompt)
}

/** Ensure every silent video generation request carries the no-music directive (idempotent). */
export function applyVideoNoBackgroundMusicPolicy (prompt: string): string {
  const base = prompt.trim()
  if (!base) return base
  if (promptAlreadyHasAudioPolicy(base)) return base
  return `${base}\n\n${VIDEO_NO_BACKGROUND_MUSIC_BLOCK}`
}

export function videoGenerationWantsAudio (opts: VideoGenerationAudioOptions): boolean {
  return opts.includeSpokenDialogue === true || opts.includeAmbientSound === true
}

function audioPolicyBlock (opts: VideoGenerationAudioOptions): string {
  const dialogue = opts.includeSpokenDialogue === true
  const ambient = opts.includeAmbientSound === true
  if (dialogue && ambient) return VIDEO_COMBINED_AUDIO_POLICY_BLOCK
  if (dialogue) return VIDEO_SPOKEN_DIALOGUE_POLICY_BLOCK
  if (ambient) return VIDEO_AMBIENT_SOUND_POLICY_BLOCK
  return VIDEO_NO_BACKGROUND_MUSIC_BLOCK
}

/** Pick prompt suffix from whether the job requests synthesized audio. */
export function applyVideoGenerationPromptPolicy (
  prompt: string,
  audio: boolean | VideoGenerationAudioOptions
): string {
  const base = prompt.trim()
  if (!base) return base
  if (promptAlreadyHasAudioPolicy(base)) return base
  const opts: VideoGenerationAudioOptions =
    typeof audio === 'boolean' ? { includeSpokenDialogue: audio } : audio
  if (!videoGenerationWantsAudio(opts)) {
    return `${base}\n\n${VIDEO_NO_BACKGROUND_MUSIC_BLOCK}`
  }
  return `${base}\n\n${audioPolicyBlock(opts)}`
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

/** Append diegetic ambient / background sound direction. */
export function appendAmbientSoundPrompt (prompt: string, ambientLine: string): string {
  const base = prompt.trim()
  const line = ambientLine.trim()
  if (!line) return base
  const block = `AMBIENT / BACKGROUND SOUND (diegetic, in-scene — no music or score):\n${line}`
  if (base.includes(line)) return base
  return base ? `${base}\n\n${block}` : block
}

/** Client/server: merge user prompt + optional dialogue and ambient fields before API call. */
export function resolveVideoGenerationUserPrompt (opts: {
  prompt: string
  dialogueLine?: string
  includeSpokenDialogue?: boolean
  ambientSoundPrompt?: string
  includeAmbientSound?: boolean
}): string {
  let out = opts.prompt.trim()
  if (opts.includeSpokenDialogue && opts.dialogueLine?.trim()) {
    out = appendSpokenDialogueLine(out, opts.dialogueLine)
  }
  if (opts.includeAmbientSound && opts.ambientSoundPrompt?.trim()) {
    out = appendAmbientSoundPrompt(out, opts.ambientSoundPrompt)
  }
  return out
}

/** OpenRouter video jobs: only synthesize audio when explicitly opted in. */
export function openRouterWantsGeneratedVideoAudio (explicit?: unknown): boolean {
  return explicit === true || explicit === 'true'
}

export function resolveVideoGenerationAudioFromBody (body: Record<string, unknown> | null | undefined): {
  includeSpokenDialogue: boolean
  includeAmbientSound: boolean
  generateAudio: boolean
} {
  const includeSpokenDialogue = openRouterWantsGeneratedVideoAudio(
    body?.includeSpokenDialogue ?? body?.include_spoken_dialogue
  )
  const includeAmbientSound = openRouterWantsGeneratedVideoAudio(
    body?.includeAmbientSound ?? body?.include_ambient_sound
  )
  const generateAudio =
    openRouterWantsGeneratedVideoAudio(body?.generateAudio ?? body?.generate_audio) ||
    includeSpokenDialogue ||
    includeAmbientSound
  return { includeSpokenDialogue, includeAmbientSound, generateAudio }
}
