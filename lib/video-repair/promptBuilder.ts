import { repairCategoryById, visualRepairCategories, type RepairCategoryId } from './categories'
import { sourceLookMatchPromptLine } from './sourceModel'
import { resolveEffectiveRepairMode, type RepairMode, type VideoRepairPromptContext } from './types'

/** Runway Aleph / OpenRouter promptText hard limit. */
export const ALEPH_PROMPT_MAX_CHARS = 1000

const EDIT_IN_PLACE =
  'Edit the source video in place. Keep the same shot, framing, blocking, timing, environment, and other characters. Do not replace the clip with a character sheet, studio backdrop, or new composition.'

const PRESERVATION_CAMERA =
  'Keep original camera, framing, blocking, timing. Do not redesign the shot.'

const PRESERVATION_STRICT =
  `${PRESERVATION_CAMERA} Preserve motion, lighting, clothing, and composition except where the instruction requires a change.`

const MODE_INSTRUCTIONS: Record<RepairMode, string> = {
  preserve: 'Smallest possible correction; if ambiguous, keep the original.',
  balanced: 'Clear visible correction to the named problem; leave everything else unchanged.',
  reimagine:
    'Strong visible correction to the named problem only; do not restyle the rest of the shot. Keep camera and timing.'
}

function categoryInstructions (ids: RepairCategoryId[]): string {
  const visual = visualRepairCategories(ids)
  if (!visual.length) return ''
  const lines = visual.map(id => repairCategoryById(id).promptFocus).filter(Boolean)
  if (!lines.length) return ''
  return `Focus: ${lines.join(' ')}`
}

function isFaceEyesRepair (ctx: VideoRepairPromptContext): boolean {
  return visualRepairCategories(ctx.categories).includes('face_eyes')
}

function truncateForPrompt (text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t || t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function characterBlock (ctx: VideoRepairPromptContext, compact: boolean): string {
  const name = (ctx.characterName || '').trim()
  const appearance = (ctx.characterAppearance || '').trim()
  const notes = (ctx.characterNotes || '').trim()
  const faceEyes = isFaceEyesRepair(ctx)
  const identityRepair =
    faceEyes || visualRepairCategories(ctx.categories).includes('character_consistency')
  if (!name && !appearance && !notes) return ''

  const bits: string[] = []
  if (name) {
    bits.push(
      faceEyes
        ? `Keep ${name}'s identity from the cast bible text (eye color/size). Do not recreate them from a lookbook plate or change pose/wardrobe/background.`
        : `Keep ${name}'s identity from the cast bible text. Do not recreate them from a lookbook plate or change the shot.`
    )
  }
  // Compact Aleph prompts still need bible appearance — previously dropped entirely.
  const appearanceBudget = compact ? (identityRepair ? 280 : 160) : 600
  const notesBudget = compact ? (identityRepair ? 120 : 80) : 400
  if (appearance) {
    bits.push(`Bible look (text only): ${truncateForPrompt(appearance, appearanceBudget)}`)
  }
  if (notes) {
    bits.push(`Bible notes (text only): ${truncateForPrompt(notes, notesBudget)}`)
  }
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
  const faceEyes = visual.includes('face_eyes')
  const priority =
    mode === 'reimagine'
      ? faceEyes
        ? 'Eyes/face change must be obvious in every frame (iris color and size). Do not return an unchanged copy. Do not invent a new shot.'
        : 'Make a clearly visible change for the named problem; do not return an unchanged copy. Do not invent a new shot.'
      : mode === 'balanced'
        ? 'The named correction must be noticeable.'
        : ''
  // Face-crop keyframes (from bible lookbook) guide eyes/identity only — never the whole set.
  const refNote = ctx.hasReferenceFrame
    ? faceEyes
      ? 'A close-up face reference is attached for iris color/size only. Keep the source framing, cave/environment, wardrobe, headlamp, and other characters. Never replace the shot with a studio character sheet.'
      : 'A close-up identity reference is attached for the named fix only. Keep the source framing and environment. Never replace the shot with a studio character sheet.'
    : ''
  // For eye fixes, do not let "match Seedance grade" override the iris color change.
  const sourceLook = faceEyes
    ? (() => {
        const line = sourceLookMatchPromptLine(ctx.sourceGenerationModel || '')
        if (!line) return ''
        return `${line} Exception: eye color/size follow the filmmaker instruction and bible text, not the source grade.`
      })()
    : sourceLookMatchPromptLine(ctx.sourceGenerationModel || '')
  const preservation = mode === 'reimagine' ? PRESERVATION_CAMERA : PRESERVATION_STRICT

  return packPrompt(
    [
      intent,
      EDIT_IN_PLACE,
      priority,
      characterBlock(ctx, compact),
      refNote,
      sourceLook,
      MODE_INSTRUCTIONS[mode],
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
