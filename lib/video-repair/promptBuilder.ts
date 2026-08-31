import { repairCategoryById, visualRepairCategories, type RepairCategoryId } from './categories'
import type { RepairMode, VideoRepairPromptContext } from './types'

const PRESERVATION_CAMERA = [
  'Keep the original camera movement, framing, blocking, lens, timing, and edit points.',
  'Do not redesign the shot or invent a new scene.'
].join(' ')

const PRESERVATION_STRICT = [
  PRESERVATION_CAMERA,
  'Preserve actor motion, facial performance, environment, lighting, clothing and composition except where the filmmaker instruction requires a change.',
  'Correct only the identified continuity problem.'
].join(' ')

const MODE_INSTRUCTIONS: Record<RepairMode, string> = {
  preserve:
    'Make the smallest possible visual correction. Stay extremely close to the source footage. If anything is ambiguous, keep the original.',
  balanced:
    'Apply a clear, visible correction to the identified problem while leaving everything else unchanged.',
  reimagine:
    'Apply a strong, clearly visible correction to the identified problem. The filmmaker instruction takes priority over matching the source for that problem. Keep camera movement, framing, and timing.'
}

function joinNonEmpty (parts: Array<string | undefined | null>, sep = '\n\n'): string {
  return parts.map(p => (p || '').trim()).filter(Boolean).join(sep)
}

function categoryInstructions (ids: RepairCategoryId[]): string {
  const visual = visualRepairCategories(ids)
  if (!visual.length) return ''
  const lines = visual.map(id => repairCategoryById(id).promptFocus).filter(Boolean)
  if (!lines.length) return ''
  return `Specifically: ${lines.join(' ')}`
}

function characterBlock (ctx: VideoRepairPromptContext): string {
  const name = (ctx.characterName || '').trim()
  const appearance = (ctx.characterAppearance || '').trim()
  const notes = (ctx.characterNotes || '').trim()
  if (!name && !appearance && !notes) {
    if (ctx.hasReferenceFrame) {
      return 'Maintain identity and appearance based on the supplied reference image throughout the shot.'
    }
    return ''
  }
  const bits: string[] = []
  if (name) {
    bits.push(
      `Maintain ${name}'s identity and appearance${ctx.hasReferenceFrame ? ' based on the supplied reference image' : ''} throughout the shot.`
    )
  } else if (ctx.hasReferenceFrame) {
    bits.push('Maintain identity and appearance based on the supplied reference image throughout the shot.')
  }
  if (appearance) bits.push(`Locked appearance: ${appearance}`)
  if (notes) bits.push(`Visual notes: ${notes}`)
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
  return `Production context (do not invent new story): ${parts.join(' ')}`
}

function userIntent (description: string): string {
  const d = description.trim()
  if (!d) return ''
  return `Filmmaker instruction: ${d}`
}

/**
 * Server-side repair instruction. Combines categories, user text, reference,
 * character/scene context, and mode-appropriate preservation language.
 */
export function buildVideoRepairPrompt (ctx: VideoRepairPromptContext): string {
  const visual = visualRepairCategories(ctx.categories)
  const mode = ctx.repairMode
  const preservation = mode === 'reimagine' ? PRESERVATION_CAMERA : PRESERVATION_STRICT
  const intent = userIntent(ctx.userDescription)
  const priority =
    mode === 'reimagine'
      ? 'Priority: the filmmaker instruction must produce a clearly visible change for the named problem. Do not return an unchanged copy of the source.'
      : mode === 'balanced'
        ? 'Priority: the correction must be noticeable on the named problem while preserving the rest of the shot.'
        : ''
  const refNote = ctx.hasReferenceFrame
    ? 'Use the supplied reference image as the target look for the correction (especially identity, eye color/size, and facial proportions).'
    : ''

  // Put filmmaker intent early so models do not over-weight preservation boilerplate.
  const prompt = joinNonEmpty([
    intent,
    priority,
    refNote,
    MODE_INSTRUCTIONS[mode],
    characterBlock(ctx),
    categoryInstructions(visual),
    sceneBlock(ctx),
    preservation
  ])
  return prompt.slice(0, 8000)
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
