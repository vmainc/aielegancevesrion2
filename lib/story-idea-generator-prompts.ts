import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

export function buildConceptSystemPrompt (goal: ProjectGoal): string {
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
- characters: JSON array of 2–6 speaking role names in ALL CAPS (e.g. ["MAYA", "JORDAN"]) — no generic labels like "OTHER" or "NARRATOR"`
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
- characters: JSON array of 2–6 speaking role names in ALL CAPS for on-screen talent`
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
- characters: JSON array of 2–8 named speaking roles in ALL CAPS (e.g. ["ELENA", "MARCUS"]) — specific names, not "OTHER" or "EXTRAS"`
}

export function buildConceptUserPrompt (
  userPrompt: string,
  goal: ProjectGoal,
  aspectRatio?: ProjectAspectRatio,
  targetDurationSeconds?: number
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

  if (goal === 'social') {
    return `Create multiple-ready short-form story concepts from this idea:

${userPrompt.trim()}${aspectLine}${runtimeLine}

Return title, logline, summary (beat outline), tone, genre, hook (opening grab), and characters (ALL CAPS names array).`
  }
  if (goal === 'commercial') {
    return `Create a compelling branded video concept from this brief:

${userPrompt.trim()}${aspectLine}${runtimeLine}

Return title, logline, summary, tone, genre, hook, and characters (ALL CAPS names array).`
  }
  return `Create a compelling concept based on this idea:

${userPrompt.trim()}${aspectLine}${runtimeLine}

Return title, logline (1 sentence), summary (3–5 sentences), tone, genre, and characters (ALL CAPS names array). Make it engaging and cinematic.`
}
