/**
 * Extract a location label from a screenplay scene heading when clearly present.
 * Examples: INT. COFFEE SHOP - DAY → Coffee Shop
 */
export function extractLocationFromSceneHeading (heading: string): string | null {
  const raw = heading.trim()
  if (!raw) return null

  const slugMatch = raw.match(
    /^(?:INT\.?|EXT\.?|I\/E\.?|INT\/EXT\.?|EST\.?)\s+(.+)$/i
  )
  if (!slugMatch) return null

  let locationPart = slugMatch[1].trim()
  locationPart = locationPart.split(/\s*[-–—]\s*/)[0]?.trim() || ''
  locationPart = locationPart.replace(/\s*\(.*\)\s*$/, '').trim()

  if (!locationPart || locationPart.length < 2) return null
  if (/^(DAY|NIGHT|MORNING|EVENING|CONTINUOUS|LATER|SAME)$/i.test(locationPart)) return null

  return titleCaseWords(locationPart)
}

function titleCaseWords (raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
