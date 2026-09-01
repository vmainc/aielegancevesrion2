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
  if (!name && !appearance && !notes) {
    if (!ctx.hasReferenceFrame) return ''
    return faceEyes
      ? 'From the reference, take only eye color/size (and any named face fix). Do not restyle the whole face from the reference.'
      : 'Match identity to the reference image.'
  }
  const bits: string[] = []
  if (name) {
    if (ctx.hasReferenceFrame && faceEyes) {
      bits.push(
        `Keep ${name}'s identity from the cast bible. Copy iris color and eye size from the reference plate; do not replace the whole face with the reference pose.`
      )
    } else if (ctx.hasReferenceFrame) {
      bits.push(`Keep ${name}'s identity from the cast bible; match the reference plate.`)
    } else {
      bits.push(`Keep ${name}'s identity from the cast bible throughout.`)
    }
  } else if (ctx.hasReferenceFrame) {
    bits.push(
      faceEyes
        ? 'From the reference, take only eye color/size (and any named face fix). Do not restyle the whole face from the reference.'
        : 'Match identity to the reference image.'
    )
  }
  // Compact Aleph prompts still need bible appearance — previously dropped entirely.
  const appearanceBudget = compact ? (identityRepair ? 280 : 160) : 600
  const notesBudget = compact ? (identityRepair ? 120 : 80) : 400
  if (appearance) {
    bits.push(`Bible look: ${truncateForPrompt(appearance, appearanceBudget)}`)
  }
  if (notes) {
    bits.push(`Plate notes: ${truncateForPrompt(notes, notesBudget)}`)
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
        ? 'Eyes/face change must be obvious in every frame (iris color and size). Do not return an unchanged copy.'
        : 'Make a clearly visible change for the named problem; do not return an unchanged copy.'
      : mode === 'balanced'
        ? 'The named correction must be noticeable.'
        : ''
  const refNote = ctx.hasReferenceFrame
    ? faceEyes
      ? 'Reference image defines the correct iris color and eye size only. Apply that look for the entire clip; ignore headlamp catchlights that make irises look lighter.'
      : 'Use the reference image as the target look (eye color/size, identity, proportions). Hold that corrected look for the entire clip — do not revert mid-shot.'
    : ''
  // For eye fixes, do not let "match Seedance grade" override the iris color change.
  const sourceLook = faceEyes
    ? (() => {
        const line = sourceLookMatchPromptLine(ctx.sourceGenerationModel || '')
        if (!line) return ''
        return `${line} Exception: eye color/size follow the filmmaker instruction and reference, not the source grade.`
      })()
    : sourceLookMatchPromptLine(ctx.sourceGenerationModel || '')
  const preservation = mode === 'reimagine' ? PRESERVATION_CAMERA : PRESERVATION_STRICT

  // Priority: filmmaker intent → reference → bible identity → look-match → mode.
  // Character bible must come before sourceLook so it is not packed out of Aleph's 1000-char limit.
  return packPrompt(
    [
      intent,
      priority,
      refNote,
      characterBlock(ctx, compact),
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
