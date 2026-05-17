/** Shared storyboard continuity helpers (client + server). */

import type { ProjectDirector } from '~/types/creative-project'

export interface CastMemberForContinuity {
  name: string
  traitsRoleVisual: string
}

const ANIMAL_SIGNAL =
  /\b(dog|cat|animal|anthropomorphic|pet|puppy|kitten|squirrel|hamster|rabbit|bear|fox|bird|creature|toast|furry|four[\s-]?leg|paw|paws|snout|whiskers|fur|feathers|hoof|hooves|critter|beast)\b/i

const HUMAN_IN_CAST =
  /\b(human|person|people|man\b|woman\b|boy\b|girl\b|adult\b|teenager|teen\b|child\b|actor\b|actress)\b/i

export const ANIMAL_ONLY_NEGATIVE_PROMPT =
  'no humans, no people, no human faces, no human hands, no human bodies, no man, no woman, no child, no crowd, no realistic human silhouettes, no human furniture occupants, only the specified animal characters from the cast bible'

export const STANDARD_STORYBOARD_NEGATIVES =
  'no watermark, no logo, no text overlay, no caption, no split screen, no diptych, no comic panels, no stacked scenes, no collage, no duplicate panels, blurry, deformed, extra limbs, wrong species, inconsistent character design, different art style than established'

/** True when the cast reads as non-human characters (e.g. animal story). */
export function isAnimalOnlyCast (cast: CastMemberForContinuity[]): boolean {
  if (!cast.length) return false
  const blob = cast.map(c => `${c.name} ${c.traitsRoleVisual}`).join(' ')
  if (HUMAN_IN_CAST.test(blob)) return false
  if (ANIMAL_SIGNAL.test(blob)) return true
  return cast.every(c => {
    const d = (c.traitsRoleVisual || '').trim()
    return d.length >= 12 && !HUMAN_IN_CAST.test(d)
  })
}

export function buildProjectNegativePrompt (opts: {
  cast: CastMemberForContinuity[]
  extra?: string
}): string {
  const parts: string[] = [STANDARD_STORYBOARD_NEGATIVES]
  if (isAnimalOnlyCast(opts.cast)) {
    parts.push(ANIMAL_ONLY_NEGATIVE_PROMPT)
  }
  const extra = (opts.extra || '').trim()
  if (extra) parts.push(extra)
  return parts.join(', ')
}

export function mergeNegativePromptParts (...parts: (string | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of parts) {
    const s = (raw || '').trim()
    if (!s) continue
    for (const chunk of s.split(/[,;]\s*/)) {
      const t = chunk.trim().toLowerCase()
      if (!t || seen.has(t)) continue
      seen.add(t)
      out.push(chunk.trim())
    }
  }
  return out.join(', ')
}

export function buildDirectorBibleBlock (director: ProjectDirector | null | undefined): string {
  const d = director
  if (!d) return ''
  const lines = [
    d.name?.trim() && `Director: ${d.name.trim()}`,
    d.style?.trim() && `Visual style: ${d.style.trim()}`,
    d.tone?.trim() && `Director tone: ${d.tone.trim()}`,
    d.camera_preferences?.trim() && `Camera language: ${d.camera_preferences.trim()}`,
    d.lighting_style?.trim() && `Lighting: ${d.lighting_style.trim()}`,
    d.pacing?.trim() && `Pacing: ${d.pacing.trim()}`
  ].filter((x): x is string => Boolean(x))
  if (!lines.length) return ''
  return ['DIRECTOR BIBLE (mandatory — apply to every frame):', ...lines].join('\n')
}

export function buildCastBibleParagraph (cast: CastMemberForContinuity[]): string {
  if (!cast.length) return ''
  return cast
    .map(c => {
      const desc = (c.traitsRoleVisual || '').trim() || 'use the established design from the cast bible'
      return `${c.name.toUpperCase()}: ${desc}`
    })
    .join('\n')
}

function shotTextBlob (shot: {
  title?: string
  description?: string
  image_prompt?: string
  imagePrompt?: string
}): string {
  return [
    shot.title,
    shot.description,
    shot.image_prompt,
    shot.imagePrompt
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Characters whose names appear in this shot's copy. */
export function castMembersInShot (
  shot: { title?: string; description?: string; image_prompt?: string; imagePrompt?: string },
  cast: CastMemberForContinuity[]
): CastMemberForContinuity[] {
  const hay = shotTextBlob(shot)
  if (!hay.trim()) return cast
  const sorted = [...cast].sort((a, b) => b.name.length - a.name.length)
  const hits: CastMemberForContinuity[] = []
  const seen = new Set<string>()
  for (const c of sorted) {
    const key = c.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    if (hay.includes(key)) {
      seen.add(key)
      hits.push(c)
    }
  }
  return hits.length ? hits : cast
}

export function buildCharacterLockForShot (
  inShot: CastMemberForContinuity[],
  animalOnly: boolean
): string {
  if (!inShot.length) return ''
  const lines = inShot.map(c => {
    const desc = (c.traitsRoleVisual || '').trim() || 'match the cast bible exactly'
    return `- ${c.name.toUpperCase()}: ${desc}`
  })
  const speciesRule = animalOnly
    ? 'Render ONLY these animal/creature characters — never add human figures or human anatomy.'
    : 'Do not redesign any named character; match face, body, materials, colors, and proportions exactly.'
  return ['CHARACTER LOCK (mandatory — identical design in every panel):', ...lines, speciesRule].join('\n')
}

export function expandShortImagePrompt (opts: {
  title: string
  description: string
  shotType: string
  cameraMove: string
  sceneTitle: string
  sceneSummary: string
  directorBible?: string
  directorStyle?: string
  directorLighting?: string
  characterLock: string
  existingImagePrompt: string
}): string {
  const base = opts.existingImagePrompt.trim() || opts.description.trim() || opts.title
  const env = [opts.sceneTitle, opts.sceneSummary].filter(Boolean).join(' — ')
  const style = [opts.directorStyle, opts.directorLighting].filter(Boolean).join('; ')
  return [
    `STORYBOARD STILL — "${opts.title}" (${opts.shotType}, camera: ${opts.cameraMove}).`,
    opts.directorBible,
    base,
    env ? `SETTING (locked across scene): ${env}` : '',
    style ? `VISUAL STYLE & LIGHTING (project-wide, do not change between panels): ${style}` : '',
    opts.characterLock,
    'Composition: single clear storyboard frame, readable silhouettes, consistent color palette and practical lighting with prior panels in this scene.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Append negative constraints for image models (no separate negative_prompt param on all SKUs). */
export function formatNegativePromptForImageModel (negative: string): string {
  const n = negative.trim()
  if (!n) return ''
  return `STRICT EXCLUSIONS (do not render): ${n}`
}

/** Keep cast lock + exclusions when trimming for ~4k image API limits. */
export function trimPromptForImageModel (prompt: string, maxLen = 3900): string {
  const p = prompt.trim()
  if (p.length <= maxLen) return p
  const negIdx = p.lastIndexOf('STRICT EXCLUSIONS')
  if (negIdx > 0 && negIdx < p.length - 80) {
    const tail = p.slice(negIdx)
    const headBudget = maxLen - tail.length - 20
    if (headBudget > 400) return `${p.slice(0, headBudget).trim()}\n\n…\n\n${tail}`
  }
  return p.slice(0, maxLen)
}
