/** Server-staged concept reference images (avoids huge JSON on /api/generate-concepts). */
export const CONCEPT_REFERENCE_IMAGE_PATH_PREFIX = '/api/concept-reference/staged/'

export function conceptReferenceImagePublicUrl (id: string): string {
  return `${CONCEPT_REFERENCE_IMAGE_PATH_PREFIX}${id}`
}

export function parseConceptReferenceImageRef (url: string): string | null {
  const u = url.trim()
  if (!u.startsWith(CONCEPT_REFERENCE_IMAGE_PATH_PREFIX)) return null
  const id = u.slice(CONCEPT_REFERENCE_IMAGE_PATH_PREFIX.length).split(/[?#]/)[0] || ''
  return /^[a-f0-9]{32}$/i.test(id) ? id : null
}
