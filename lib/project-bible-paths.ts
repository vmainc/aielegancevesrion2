/** Deep-link into Production Bible for a cast character lookbook. */
export function projectBibleCastPath (
  projectId: string,
  characterId: string,
  name?: string
): string {
  const q = new URLSearchParams()
  q.set('cast', characterId.trim())
  const n = (name || '').trim()
  if (n) q.set('name', n)
  return `/projects/${projectId}/bible?${q.toString()}`
}

/** Deep-link into Production Bible for a bible entity. */
export function projectBibleEntityPath (projectId: string, entityId: string): string {
  const q = new URLSearchParams()
  q.set('entity', entityId.trim())
  return `/projects/${projectId}/bible?${q.toString()}`
}
