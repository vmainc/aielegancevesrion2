import type { ProjectTargetLength } from '~/types/creative-project'

export function isMusicVideoTarget (targetLength?: ProjectTargetLength): boolean {
  return targetLength === 'music_video'
}

/** Music videos use an external track — do not ask OpenRouter to synthesize audio in the clip. */
export function projectWantsGeneratedVideoAudio (targetLength?: ProjectTargetLength): boolean {
  return !isMusicVideoTarget(targetLength)
}
