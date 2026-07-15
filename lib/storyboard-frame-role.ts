export type StoryboardFrameRole = 'start' | 'end'

export function storyboardFrameRoleLabel (role: StoryboardFrameRole): string {
  return role === 'start' ? 'Start frame' : 'End frame'
}

/** Cache key for per-slot preview / busy state (start keeps bare shot id for backward compat). */
export function storyboardFrameSlotKey (shotId: string, role: StoryboardFrameRole): string {
  return role === 'start' ? shotId : `${shotId}:end`
}

export function parseStoryboardFrameSlotKey (key: string): { shotId: string; role: StoryboardFrameRole } {
  if (key.endsWith(':end')) {
    return { shotId: key.slice(0, -4), role: 'end' }
  }
  return { shotId: key, role: 'start' }
}
