import { canonicalizeShotCastNames } from '~/lib/cast-name-convention'
import {
  buildProjectNegativePrompt,
  castMembersInShot,
  formatNegativePromptForImageModel,
  mergeNegativePromptParts
} from '~/lib/storyboard-continuity-prompts'
import type { UnifiedShotPromptContext } from '~/lib/unified-shot-prompt'
import type { CreativeShot } from '~/types/creative-shot'

/** Merged shot + project + per-character avoid list for video generation. */
export function resolveVideoNegativePromptForShot (
  shot: Pick<
    CreativeShot,
    'title' | 'description' | 'imagePrompt' | 'videoPrompt' | 'negativePrompt' | 'shotType'
  >,
  ctx: UnifiedShotPromptContext
): string {
  const cast = ctx.cast
  const shotCanon = canonicalizeShotCastNames(shot, cast)
  const inShot = castMembersInShot(
    {
      title: shotCanon.title,
      description: shotCanon.description,
      image_prompt: shotCanon.imagePrompt,
      imagePrompt: shotCanon.imagePrompt
    },
    cast
  )
  return mergeNegativePromptParts(
    shotCanon.negativePrompt,
    buildProjectNegativePrompt({ cast, inShot })
  )
}

function isNegativePassthroughParam (name: string): boolean {
  return name.replace(/_/g, '').toLowerCase() === 'negativeprompt'
}

/** OpenRouter `allowed_passthrough_parameters` entry for native video negatives. */
export function resolveVideoNegativePassthroughParamName (
  allowedPassthrough: string[] | undefined
): string | undefined {
  if (!allowedPassthrough?.length) return undefined
  return allowedPassthrough.find(isNegativePassthroughParam)
}

/** Remove embedded STRICT EXCLUSIONS block so negatives can be edited/sent separately. */
export function stripStrictExclusionsFromPrompt (prompt: string): string {
  const p = prompt.trim()
  const idx = p.search(/(?:^|\n)STRICT EXCLUSIONS(?: \(do not render\))?:/i)
  if (idx < 0) return p
  return p.slice(0, idx).trim().replace(/\n---\s*$/, '').trim()
}

/**
 * Clean merged avoid list for native video APIs (Veo negativePrompt, Wan negative_prompt).
 * Strips cast labels and STRICT EXCLUSIONS headers — listing forbidden items in the
 * positive prompt inverts results on most video models.
 */
export function normalizeVideoNegativePromptForApi (negative: string): string {
  let n = negative.trim()
  if (!n) return ''
  n = n.replace(/^STRICT EXCLUSIONS(?: \(do not render\))?:\s*/i, '')

  const seen = new Set<string>()
  const out: string[] = []
  for (const rawChunk of n.split(/[,;\n]+/)) {
    let chunk = rawChunk.trim()
    if (!chunk) continue
    const forCast = chunk.match(/^for\s+[^:]+:\s*(.+)$/i)
    if (forCast?.[1]) chunk = forCast[1].trim()
    if (!chunk) continue
    const key = chunk.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(chunk)
  }
  return out.join(', ').slice(0, 4000)
}

/** @deprecated Image/storyboard only — do not append to video generation prompts. */
export function appendStrictExclusionsToPrompt (prompt: string, negative: string): string {
  const base = prompt.trim()
  const n = negative.trim()
  if (!n) return base
  if (/STRICT EXCLUSIONS/i.test(base)) return base
  const block = formatNegativePromptForImageModel(n)
  return block ? `${base}\n\n${block}` : base
}

export function modelSupportsNativeNegativePrompt (
  allowedPassthrough: string[] | undefined
): boolean {
  return Boolean(resolveVideoNegativePassthroughParamName(allowedPassthrough))
}
