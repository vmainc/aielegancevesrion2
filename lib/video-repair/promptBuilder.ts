import { repairCategoryById, visualRepairCategories, type RepairCategoryId } from './categories'
import { sourceLookMatchPromptLine } from './sourceModel'
import { resolveEffectiveRepairMode, type RepairMode, type VideoRepairPromptContext } from './types'

/** Runway Aleph / OpenRouter promptText hard limit. */
export const ALEPH_PROMPT_MAX_CHARS = 1000

const PRESERVATION_CAMERA =
  'Keep original camera, framing, blocking, timing. Do not redesign the shot.'

const PRESERVATION_STRICT =
  `${PRESERVATION_CAMERA} Preserve motion, lighting, clothing, and composition except where the instruction requires a change.`

const MODE_INSTRUCTIONS: Record<RepairMode, string> = {
  preserve: 'Smallest possible correction; if ambiguous, keep the original.',
  balanced: 'Clear visible correction to the named problem; leave everything else unchanged.',
  reimagine:
    'Strong visible correction to the named problem; instruction overrides matching the source for that problem. Keep camera and timing.'
}

function joinNonEmpty (parts: Array<string | undefined | null>, sep = '\n'): string {
  return parts.map(p => (p || '').trim()).filter(Boolean).join(sep)
}

function categoryInstructions (ids: RepairCategoryId[]): string {
  const visual = visualRepairCategories(ids)
  if (!visual.length) return ''
  const lines = visual.map(id => repairCategoryById(id).promptFocus).filter(Boolean)
  if (!lines.length) return ''
  return `Focus: ${lines.join(' ')}`
}

function characterBlock (ctx: VideoRepairPromptContext, compact: boolean): string {
  const name = (ctx.characterName || '').trim()
  const appearance = (ctx.characterAppearance || '').trim()
  const notes = (ctx.characterNotes || '').trim()
  if (!name && !appearance && !notes) {
    return ctx.hasReferenceFrame
      ? 'Match identity to the reference image.'
      : ''
  }
  const bits: string[] = []
  if (name) {
    bits.push(
      ctx.hasReferenceFrame
        ? `Keep ${name}'s identity; match the reference image.`
        : `Keep ${name}'s identity throughout.`
    )
  } else if (ctx.hasReferenceFrame) {
    bits.push('Match identity to the reference image.')
  }
  if (!compact && appearance) bits.push(`Appearance: ${appearance}`)
  if (!compact && notes) bits.push(`Notes: ${notes}`)
  return bits.join(' ')
}

function sceneBlock (ctx: VideoRepairPromptContext): string {
  const parts: string[] = []
  const heading = (ctx.sceneHeading || '').trim()
  const summary = (ctx.sceneSummary || '').trim()
  const shotTitle = (ctx.shotTitle || '').trim()
  const shotDesc = (ctx.shotDescription || '').trim()
  const shotType = (ctx.shotType || '').trim()
  const camera = (ctx.cameraMove || '').trim()
  if (heading) parts.push(`Scene: ${heading}.`)
  if (summary) parts.push(summary)
  if (shotTitle) parts.push(`Shot: ${shotTitle}.`)
  if (shotType || camera) {
    parts.push(`Coverage: ${[shotType, camera].filter(Boolean).join(', ')}.`)
  }
  if (shotDesc) parts.push(shotDesc)
  if (!parts.length) return ''
  return `Context: ${parts.join(' ')}`
}

function packPrompt (parts: string[], maxChars: number): string {
  let out = ''
  for (const part of parts) {
    const p = part.trim()
    if (!p) continue
    const next = out ? `${out}\n${p}` : p
    if (next.length <= maxChars) {
      out = next
      continue
    }
    if (!out) {
      // First (filmmaker) chunk must fit — hard truncate.
      return p.slice(0, maxChars)
    }
    // Keep what we have; skip lower-priority parts.
    break
  }
  return out.slice(0, maxChars)
}

/**
 * Server-side repair instruction. Combines categories, user text, reference,
 * character/scene context, and mode-appropriate preservation language.
 * Defaults to Aleph's 1000-char promptText limit.
 */
export function buildVideoRepairPrompt (
  ctx: VideoRepairPromptContext,
  opts?: { maxChars?: number }
): string {
  const maxChars = Math.max(200, Math.floor(opts?.maxChars ?? ALEPH_PROMPT_MAX_CHARS))
  const compact = maxChars <= ALEPH_PROMPT_MAX_CHARS
  const visual = visualRepairCategories(ctx.categories)
  const user = (ctx.userDescription || '').trim()
  const mode = resolveEffectiveRepairMode(ctx.repairMode, visual, user)
  const intent = user ? `Filmmaker instruction: ${user}` : ''
  const priority =
    mode === 'reimagine'
      ? 'Make a clearly visible change for the named problem; do not return an unchanged copy.'
      : mode === 'balanced'
        ? 'The named correction must be noticeable.'
        : ''
  const refNote = ctx.hasReferenceFrame
    ? 'Use the reference image as the target look (eye color/size, identity, proportions). Hold that corrected look for the entire clip — do not revert mid-shot.'
    : ''
  const sourceLook = sourceLookMatchPromptLine(ctx.sourceGenerationModel || '')
  const preservation = mode === 'reimagine' ? PRESERVATION_CAMERA : PRESERVATION_STRICT

  // Priority order: instruction first, then look-match / guidance, then optional context.
  return packPrompt(
    [
      intent,
      priority,
      sourceLook,
      refNote,
      MODE_INSTRUCTIONS[mode],
      characterBlock(ctx, compact),
      categoryInstructions(visual),
      compact ? '' : sceneBlock(ctx),
      preservation
    ],
    maxChars
  )
}

/** Extra prompt language for providers that have no native preserve/flex/reimagine modes. */
export function repairModePromptAddon (mode: RepairMode): string {
  return MODE_INSTRUCTIONS[mode]
}

export function defaultRepairDescriptionExample (): string {
  return 'The woman\'s eyes become too large halfway through the shot. Keep her facial proportions, skin tone, hair and clothing consistent with the beginning of the video.'
}

export function versionLabelFromCategories (ids: RepairCategoryId[]): string {
  const visual = visualRepairCategories(ids)
  if (!visual.length) return 'Repair'
  if (visual.length === 1) return repairCategoryById(visual[0]!).label
  if (visual.length === 2) {
    return `${repairCategoryById(visual[0]!).label} + ${repairCategoryById(visual[1]!).label}`
  }
  return 'Continuity Repair'
}
