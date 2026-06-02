import type { ProjectTargetLength } from '~/types/creative-project'

export function isMusicVideoTarget (targetLength?: ProjectTargetLength): boolean {
  return targetLength === 'music_video'
}

/** Score and music belong on the timeline — not in AI-generated clips. */
export function projectWantsGeneratedVideoAudio (_targetLength?: ProjectTargetLength): boolean {
  return false
}
