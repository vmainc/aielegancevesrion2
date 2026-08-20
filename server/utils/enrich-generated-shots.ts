import type { GeneratedShot, GenerateShotsContext } from '~/server/utils/generate-shots-ai'
import { formatCastNameForPrompt, normalizeCharacterNameKey } from '~/lib/cast-name-convention'
import { applyUnifiedPromptsToShot } from '~/lib/unified-shot-prompt'
import { resolveSetLock } from '~/lib/set-lock'

function resolveShotCastNames (
  requested: string[] | undefined,
  projectCast: Array<{ name: string }>
): string[] {
  if (!requested?.length || !projectCast.length) return []
  const byKey = new Map(projectCast.map(c => [normalizeCharacterNameKey(c.name), c.name]))
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of requested) {
    const key = normalizeCharacterNameKey(raw)
    const resolved = byKey.get(key)
    if (!resolved) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(resolved)
  }
  return out
}

/**
 * Seed explicit per-panel cast into description/image so CHARACTER LOCK and UI chips
 * stay shot-local (not the full project cast bible).
 */
function withCastInPanelBeat (shot: GeneratedShot, castNames: string[]): GeneratedShot {
  if (!castNames.length) return shot
  const line = `Cast in this panel: ${castNames.map(n => formatCastNameForPrompt(n)).join(', ')}.`
  if (/Cast in this panel:/i.test(shot.description) && /Cast in this panel:/i.test(shot.image_prompt)) {
    return shot
  }
  return {
    ...shot,
    description: /Cast in this panel:/i.test(shot.description)
      ? shot.description
      : `${shot.description}\n${line}`.slice(0, 5000),
    image_prompt: /Cast in this panel:/i.test(shot.image_prompt)
      ? shot.image_prompt
      : `${line}\n${shot.image_prompt}`.slice(0, 8000)
  }
}

/**
 * Single enrichment pass for AI-generated shot rows before persist.
 *
 * Call once after continuity check in execute-generate-shots (or once after raw
 * generation in import-storyboard-seed). Do not call from generateShotsWithAi.
 *
 * Delegates to applyUnifiedPromptsToShot in lib/unified-shot-prompt.ts (idempotent
 * when prompts are already unified).
 */
export function enrichGeneratedShotsForContinuity (
  shots: GeneratedShot[],
  ctx: GenerateShotsContext
): GeneratedShot[] {
  const cast = ctx.characters.map(c => ({
    name: c.name,
    traitsRoleVisual: c.traitsRoleVisual
  }))

  const unifiedCtx = {
    director: ctx.director,
    continuityMemory: ctx.continuityMemory || '',
    aspectRatio: ctx.aspectRatio,
    sceneTitle: ctx.sceneTitle,
    sceneSummary: ctx.sceneSummary,
    cast,
    setLock: ctx.setLock ?? resolveSetLock({ sceneHeading: ctx.sceneTitle })
  }

  return shots.map((shot, index) => {
    const castNames = resolveShotCastNames(shot.characters, cast)
    const seeded = withCastInPanelBeat(shot, castNames)
    const asCreativeShot = {
      title: seeded.title,
      description: seeded.description,
      shotType: seeded.shot_type,
      cameraMove: seeded.camera_move,
      imagePrompt: seeded.image_prompt,
      videoPrompt: seeded.video_prompt,
      negativePrompt: seeded.negative_prompt
    } as import('~/types/creative-shot').CreativeShot

    const panelIndex =
      typeof seeded.order === 'number' && Number.isFinite(seeded.order)
        ? Math.max(0, seeded.order - 1)
        : index
    const applied = applyUnifiedPromptsToShot(asCreativeShot, { ...unifiedCtx, panelIndex })

    return {
      ...seeded,
      description: seeded.description,
      image_prompt: applied.imagePrompt.slice(0, 8000),
      video_prompt: applied.videoPrompt.slice(0, 4000),
      negative_prompt: applied.negativePrompt.slice(0, 4000)
    }
  })
}
