import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'
import {
  buildDurationBudgetFromSeconds,
  conceptDurationGuidance,
  type ProjectDurationBudget
} from '~/lib/project-duration-budget'

const DIRECTOR_BIBLE_JSON_KEYS = `
- director_bible: object with string keys "name", "style", "tone", "camera_preferences", "lighting_style", "pacing" — a practical director bible for image/video generation (not biography)
- visual_reference: 2–4 sentences on how the reference image (if any) informs look, palette, wardrobe, and mood`

function resolveConceptBudget (targetDurationSeconds?: number): ProjectDurationBudget | null {
  if (typeof targetDurationSeconds !== 'number' || targetDurationSeconds < 15) return null
  return buildDurationBudgetFromSeconds(targetDurationSeconds)
}

function summaryRuleForBudget (budget: ProjectDurationBudget | null): string {
  if (!budget) return 'summary: 3–5 sentences, cinematic and engaging'
  if (budget.totalSeconds <= 25) return 'summary: 2–4 short sentences — one micro-arc only (what we see in order)'
  if (budget.totalSeconds <= 60) return 'summary: 2–4 sentences — linear beats that fit the second budget'
  if (budget.totalSeconds <= 120) return 'summary: 3–5 tight sentences — one problem, one resolution'
  return 'summary: 3–6 sentences scaled to runtime — no feature-length scope'
}

function charactersRuleForBudget (budget: ProjectDurationBudget | null, goal: ProjectGoal): string {
  if (!budget) {
    if (goal === 'social' || goal === 'commercial') {
      return 'characters: JSON array of 2–6 speaking role names in ALL CAPS'
    }
    return 'characters: JSON array of 2–8 named speaking roles in ALL CAPS — specific names, not "OTHER" or "EXTRAS"'
  }
  if (budget.totalSeconds <= 25) {
    return 'characters: JSON array of 0–2 ALL CAPS names (prefer 1–2)'
  }
  if (budget.totalSeconds <= 60) {
    return 'characters: JSON array of 2–3 ALL CAPS names maximum'
  }
  return 'characters: JSON array of 2–5 ALL CAPS names — only who appears on screen'
}

export function buildConceptSystemPrompt (
  goal: ProjectGoal,
  hasReferenceImage = false,
  targetDurationSeconds?: number
): string {
  const budget = resolveConceptBudget(targetDurationSeconds)
  const durationBlock = budget ? `\n\n${conceptDurationGuidance(budget, goal)}` : ''
  const imageRules = hasReferenceImage
    ? ` When a reference image is attached, study it carefully. Align story, tone, and director_bible with what you see; do not contradict visible subjects, palette, or setting.${DIRECTOR_BIBLE_JSON_KEYS}`
    : ''

  const summaryRule = summaryRuleForBudget(budget)
  const charactersRule = charactersRuleForBudget(budget, goal)

  if (goal === 'social') {
    return `You are a short-form video story strategist (TikTok, Reels, YouTube Shorts, social ads).

The user describes a content idea. Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "hook", "characters"

Rules:
- title: catchy working title for the piece
- logline: one sentence pitch — must fit the runtime budget below
- ${summaryRule}
- tone: short phrase (e.g. "playful, fast-cut")
- genre: format label (e.g. "sketch comedy", "product demo", "POV story")
- hook: the first 1–3 seconds — what grabs attention (visual or line)
- ${charactersRule}${imageRules}${durationBlock}`
  }
  if (goal === 'commercial') {
    return `You are a commercial / branded video concept writer.

Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "hook", "characters"

Rules:
- title: campaign or spot title
- logline: one sentence value proposition — must fit runtime below
- ${summaryRule}
- tone: short phrase
- genre: e.g. "brand film", "product launch", "testimonial"
- hook: opening beat that stops the scroll
- ${charactersRule}${imageRules}${durationBlock}`
  }
  return `You are a film and video concept generator.

Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "characters"

Rules:
- title: compelling working title
- logline: exactly one sentence — scoped to the runtime budget below
- ${summaryRule}
- tone: short phrase (e.g. "tense, intimate")
- genre: primary genre label (e.g. "sci-fi thriller")
- ${charactersRule}${imageRules}${durationBlock}`
}

export function buildConceptUserMessageContent (input: {
  userPrompt: string
  goal: ProjectGoal
  aspectRatio?: ProjectAspectRatio
  targetDurationSeconds?: number
  referenceImageDataUrl?: string | null
  referenceImageBrief?: string
}): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const text = buildConceptUserPrompt(
    input.userPrompt,
    input.goal,
    input.aspectRatio,
    input.targetDurationSeconds,
    input.referenceImageBrief
  )
  const dataUrl = (input.referenceImageDataUrl || '').trim()
  if (!dataUrl) return text
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: dataUrl } }
  ]
}

export function buildConceptUserPrompt (
  userPrompt: string,
  goal: ProjectGoal,
  aspectRatio?: ProjectAspectRatio,
  targetDurationSeconds?: number,
  referenceImageBrief?: string
): string {
  const budget = resolveConceptBudget(targetDurationSeconds)
  const aspect =
    aspectRatio === '9:16'
      ? 'vertical 9:16'
      : aspectRatio === '1:1'
        ? 'square 1:1'
        : aspectRatio === '16:9'
          ? 'landscape 16:9'
          : ''
  const aspectLine = aspect ? `\nTarget frame: ${aspect}.` : ''
  const runtimeBlock = budget
    ? `\n\n${conceptDurationGuidance(budget, goal)}\n\nThe user's idea must be adapted to this runtime — do NOT pitch a longer film.`
    : ''
  const refLine = (referenceImageBrief || '').trim()
    ? `\n\nREFERENCE IMAGE ANALYSIS (use for visual_reference and director_bible):\n${referenceImageBrief.trim()}`
    : ''

  const ideaBlock = userPrompt.trim() || '(No written idea — infer story from the reference image only.)'

  if (goal === 'social') {
    return `Create short-form story concepts from this idea. Respect the runtime budget — this is the master constraint for scope:

${ideaBlock}${aspectLine}${runtimeBlock}${refLine}

Return title, logline, summary (beat outline sized to runtime), tone, genre, hook (opening grab), characters (ALL CAPS names array), director_bible, and visual_reference.`
  }
  if (goal === 'commercial') {
    return `Create a branded video concept from this brief. The runtime budget controls everything — one spot, not a campaign series:

${ideaBlock}${aspectLine}${runtimeBlock}${refLine}

Return title, logline, summary, tone, genre, hook, characters (ALL CAPS names array), director_bible, and visual_reference.`
  }
  return `Create a concept based on this idea. The runtime budget is the master constraint — do not outline a feature if seconds are low:

${ideaBlock}${aspectLine}${runtimeBlock}${refLine}

Return title, logline (1 sentence), summary (scoped to runtime), tone, genre, characters (ALL CAPS names array), director_bible, and visual_reference.`
}
