import type { CreativeShot } from '~/types/creative-shot'
import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'

export type EndFrameShotFields = Pick<
  CreativeShot,
  'title' | 'description' | 'videoPrompt' | 'cameraMove' | 'shotType'
>

/**
 * Summarize what this board’s video clip is trying to accomplish (for end-frame guidance).
 */
export function describeShotClipPurpose (shot: EndFrameShotFields): string {
  const title = (shot.title || '').trim()
  const beat = (shot.description || '').trim()
  const motion = (shot.videoPrompt || '').trim()
  const camera = (shot.cameraMove || '').trim()
  const shotType = (shot.shotType || '').trim()

  const parts: string[] = []
  if (title) parts.push(`"${title}"`)
  if (shotType) parts.push(`${shotType} shot`)
  if (camera) parts.push(`camera: ${camera}`)
  if (beat) parts.push(beat)
  else if (motion && motion.length < 600) parts.push(motion)

  return parts.join(' — ') || 'Complete the motion implied by the start frame and production prompt.'
}

/**
 * Turn a start-frame / unified production prompt into an end-frame still that finishes the clip’s beat.
 */
export function buildStoryboardEndFramePrompt (
  startFramePrompt: string,
  shot: EndFrameShotFields
): string {
  const base = (startFramePrompt || '').trim()
  const purpose = describeShotClipPurpose(shot)
  const block = [
    '=== END FRAME (concluding still of this video clip) ===',
    `Purpose of this clip: ${purpose}`,
    'Generate the LAST frame of this shot — the visual result AFTER the action and camera move finish.',
    '- Same cast, wardrobe, lighting language, and location as the start / reference still.',
    '- Advance pose, position, and composition to the logical end of the beat (e.g. landing after a leap, settled reaction, completed camera move, arrived framing).',
    '- Do NOT redraw the opening pose. Do NOT invent a new scene, new characters, or a different wardrobe.',
    '- Single still only; no collage, split screen, timeline strip, or motion-blur streaks.'
  ].join('\n')

  if (!base) return block
  if (/=== END FRAME/i.test(base)) return base
  return `${base}\n\n${block}`
}

export function applyStoryboardFrameRoleToPrompt (
  prompt: string,
  role: StoryboardFrameRole,
  shot: EndFrameShotFields
): string {
  if (role !== 'end') return prompt
  return buildStoryboardEndFramePrompt(prompt, shot)
}

/** True when either start or end frame is still missing. */
export function shotMissingStoryboardFrame (
  hasStart: boolean,
  hasEnd: boolean
): boolean {
  return !hasStart || !hasEnd
}
