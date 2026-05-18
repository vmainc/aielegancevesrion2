import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const DIRECTOR_BIBLE_JSON_KEYS = `
- director_bible: object with string keys "name", "style", "tone", "camera_preferences", "lighting_style", "pacing" — a practical director bible for image/video generation (not biography)
- visual_reference: 2–4 sentences on how the reference image (if any) informs look, palette, wardrobe, and mood`

export function buildConceptSystemPrompt (goal: ProjectGoal, hasReferenceImage = false): string {
  const imageRules = hasReferenceImage
    ? ` When a reference image is attached, study it carefully. Align story, tone, and director_bible with what you see; do not contradict visible subjects, palette, or setting.${DIRECTOR_BIBLE_JSON_KEYS}`
    : ''
  if (goal === 'social') {
    return `You are a short-form video story strategist (TikTok, Reels, YouTube Shorts, social ads).

The user describes a content idea. Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "hook", "characters"

Rules:
- title: catchy working title for the piece
- logline: one sentence pitch
- summary: 3–5 sentences — beat outline, visual moments, and payoff (not a screenplay)
- tone: short phrase (e.g. "playful, fast-cut")
- genre: format label (e.g. "sketch comedy", "product demo", "POV story")
- hook: the first 1–3 seconds — what grabs attention (visual or line)
- characters: JSON array of 2–6 speaking role names in ALL CAPS (e.g. ["MAYA", "JORDAN"]) — no generic labels like "OTHER" or "NARRATOR"${imageRules}`
  }
  if (goal === 'commercial') {
    return `You are a commercial / branded video concept writer.

Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "hook", "characters"

Rules:
- title: campaign or spot title
- logline: one sentence value proposition
- summary: 3–5 sentences — story arc, product/brand role, and CTA moment
- tone: short phrase
- genre: e.g. "brand film", "product launch", "testimonial"
- hook: opening beat that stops the scroll
- characters: JSON array of 2–6 speaking role names in ALL CAPS for on-screen talent${imageRules}`
  }
  return `You are a film and video concept generator.

Respond with ONLY valid JSON (no markdown fences), one object with string keys:
"title", "logline", "summary", "tone", "genre", "characters"

Rules:
- title: compelling working title
- logline: exactly one sentence
- summary: 3–5 sentences, cinematic and engaging
- tone: short phrase (e.g. "tense, intimate")
- genre: primary genre label (e.g. "sci-fi thriller")
- characters: JSON array of 2–8 named speaking roles in ALL CAPS (e.g. ["ELENA", "MARCUS"]) — specific names, not "OTHER" or "EXTRAS"${imageRules}`
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
  const aspect =
    aspectRatio === '9:16'
      ? 'vertical 9:16'
      : aspectRatio === '1:1'
        ? 'square 1:1'
        : aspectRatio === '16:9'
          ? 'landscape 16:9'
          : ''
  const aspectLine = aspect ? `\nTarget frame: ${aspect}.` : ''
  const runtimeLine =
    typeof targetDurationSeconds === 'number' && targetDurationSeconds >= 15
      ? `\nTarget runtime: ${targetDurationSeconds} seconds total — story must fit this length when storyboarded (5s panels).`
      : ''
  const refLine = (referenceImageBrief || '').trim()
    ? `\n\nREFERENCE IMAGE ANALYSIS (use for visual_reference and director_bible):\n${referenceImageBrief.trim()}`
    : ''

  const ideaBlock = userPrompt.trim() || '(No written idea — infer story from the reference image only.)'

  if (goal === 'social') {
    return `Create multiple-ready short-form story concepts from this idea:

${ideaBlock}${aspectLine}${runtimeLine}${refLine}

Return title, logline, summary (beat outline), tone, genre, hook (opening grab), characters (ALL CAPS names array), director_bible, and visual_reference.`
  }
  if (goal === 'commercial') {
    return `Create a compelling branded video concept from this brief:

${ideaBlock}${aspectLine}${runtimeLine}${refLine}

Return title, logline, summary, tone, genre, hook, characters (ALL CAPS names array), director_bible, and visual_reference.`
  }
  return `Create a compelling concept based on this idea:

${ideaBlock}${aspectLine}${runtimeLine}${refLine}

Return title, logline (1 sentence), summary (3–5 sentences), tone, genre, characters (ALL CAPS names array), director_bible, and visual_reference. Make it engaging and cinematic.`
}
