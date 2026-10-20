const TIME_OF_DAY =
  /^(day|night|morning|evening|dusk|dawn|continuous|later|same|moments later|same time|later that night|the next day|moments earlier)$/i

/**
 * Place segments in a slug, most general first. Time-of-day tails are dropped.
 * INT. PENTAGON - WAR ROOM - CONTINUOUS → ["Pentagon", "War Room"]
 */
export function sceneHeadingLocationParts (heading: string): string[] {
  const raw = heading.trim()
  if (!raw) return []
  const slugMatch = raw.match(
    /^(?:INT\.?|EXT\.?|I\/E\.?|INT\/EXT\.?|EST\.?)\s+(.+)$/i
  )
  if (!slugMatch) return []
  const parts = slugMatch[1]
    .split(/\s*[-–—]\s*/)
    .map((s) => s.replace(/\s*\(.*\)\s*$/, '').trim())
    .filter((s) => s.length >= 2)
  while (parts.length && TIME_OF_DAY.test(parts[parts.length - 1] || '')) {
    parts.pop()
  }
  return parts.map(titleCaseWords)
}

/**
 * Extract a location label from a screenplay scene heading when clearly present.
 * Examples: INT. COFFEE SHOP - DAY → Coffee Shop
 * The first place segment is the parent location (Pentagon, not War Room).
 */
export function extractLocationFromSceneHeading (heading: string): string | null {
  const first = sceneHeadingLocationParts(heading)[0]
  return first || null
}

function titleCaseWords (raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
