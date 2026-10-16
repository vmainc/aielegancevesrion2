/** Appended to silent video prompts so models do not invent inconsistent scores. */
export const VIDEO_NO_BACKGROUND_MUSIC_BLOCK = `AUDIO POLICY — NO SCORE OR MUSIC:
No background music, score, soundtrack, or musical underscore.
No songs or licensed-style beds.
Ambient diegetic sound only if needed (wind, room tone, footsteps).
No spoken dialogue unless explicitly written in the prompt above.
Music and score are handled separately during post-production — visuals and motion only.`

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

export type CharacterVoiceLock = {
  name: string
  /** Timbre notes from the character. Never placed inside the spoken quote. */
  voiceDescription?: string
}

export type SpokenDialogueLineOptions = {
  /** Character name who delivers the line. */
  speakerName?: string
  /** Delivery tone, e.g. urgent, whispered, calm. */
  tone?: string
}

const VOICE_LOCK_MARKER = 'VOICE LOCK (timbre only'

export function promptAlreadyHasVoiceLock (prompt: string): boolean {
  return prompt.includes(VOICE_LOCK_MARKER)
}

/** Timbre block. Descriptions are stripped of quotes so they cannot be spoken as lines. */
export function buildVoiceLockBlock (locks: CharacterVoiceLock[]): string {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const lock of locks) {
    const name = (lock.name || '').trim()
    let voice = (lock.voiceDescription || '')
      .replace(/["“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!name || !voice) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (voice.length > 400) voice = `${voice.slice(0, 400).trimEnd()}…`
    lines.push(`${name}: ${voice}`)
  }
  if (!lines.length) return ''
  return [
    `${VOICE_LOCK_MARKER}, never spoken aloud, never written on screen):`,
    ...lines
  ].join('\n')
}

/** Insert the voice lock ahead of spoken dialogue. Idempotent. */
export function applyVoiceLock (prompt: string, locks: CharacterVoiceLock[]): string {
  const block = buildVoiceLockBlock(locks)
  const base = prompt.trim()
  if (!block || promptAlreadyHasVoiceLock(base)) return base
  const marker = 'SPOKEN DIALOGUE (must be clearly audible'
  const idx = base.indexOf(marker)
  if (idx >= 0) {
    return `${base.slice(0, idx).trim()}\n\n${block}\n\n${base.slice(idx).trim()}`
  }
  return base ? `${base}\n\n${block}` : block
}

/** Append an explicit line for the model to speak (shown in UI + sent to API). */
export function appendSpokenDialogueLine (
  prompt: string,
  dialogueLine: string,
  opts?: SpokenDialogueLineOptions
): string {
  const base = prompt.trim()
  const line = dialogueLine.trim()
  if (!line) return base
  const speaker = (opts?.speakerName || '').trim()
  const tone = (opts?.tone || '').trim()
  const parts: string[] = ['SPOKEN DIALOGUE (must be clearly audible in the clip):']
  if (speaker) {
    parts.push(`Speaker: ${speaker}`)
  }
  const toneWord = tone.trim().toLowerCase()
  if (toneWord && toneWord !== 'neutral') {
    parts.push(`Delivery only, never spoken aloud: ${toneWord}`)
  }
  if (speaker) {
    parts.push(`${speaker} says this line aloud: "${line}"`)
  } else {
    parts.push(`Line (spoken aloud): "${line}"`)
  }
  const block = parts.join('\n')
  if (base.includes(line) && (!speaker || base.includes(speaker))) return base
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
  dialogueSpeakerName?: string
  dialogueTone?: string
  ambientSoundPrompt?: string
  includeAmbientSound?: boolean
  /** Cast timbre notes for people in this shot. */
  voiceLocks?: CharacterVoiceLock[]
}): string {
  let out = applyVoiceLock(opts.prompt.trim(), opts.voiceLocks || [])
  if (opts.includeSpokenDialogue && opts.dialogueLine?.trim()) {
    out = appendSpokenDialogueLine(out, opts.dialogueLine, {
      speakerName: opts.dialogueSpeakerName,
      tone: opts.dialogueTone
    })
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
