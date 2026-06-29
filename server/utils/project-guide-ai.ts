import { GUIDE_FIELD_LABELS, type GuideSuggestion } from '~/lib/project-guide'
import type { ProjectGuideContext } from '~/server/utils/project-guide-context'

const ALLOWED_PROJECT_FIELDS = new Set([
  'synopsis',
  'treatment',
  'conceptNotes',
  'genre',
  'tone',
  'continuityMemory'
])

const ALLOWED_DIRECTOR_FIELDS = new Set([
  'style',
  'tone',
  'camera_preferences',
  'lighting_style',
  'pacing'
])

const ALLOWED_CHARACTER_FIELDS = new Set([
  'roleDescription',
  'appearanceDescription',
  'personality',
  'voiceDescription',
  'signatureDetails',
  'avoidDescription'
])

function extractJsonObject (text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>
    } catch {
      return null
    }
  }
  let j = tryParse(trimmed)
  if (j && typeof j === 'object' && !Array.isArray(j)) return j
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    j = tryParse(trimmed.slice(start, end + 1))
    if (j && typeof j === 'object' && !Array.isArray(j)) return j
  }
  return null
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildProjectGuideSystemPrompt (ctx: ProjectGuideContext): string {
  return `You are the Project Guide for AI Elegance — a film pre-production copilot embedded in one creative project.

Your job:
1. Help the filmmaker think through story, characters, tone, and continuity.
2. Answer questions using ONLY the project context below (do not invent cast or plot facts not supported by context unless clearly labeled as a creative suggestion).
3. When the user states a decision or refinement that should persist in the project bible, propose structured updates via the suggestions array — never silently assume changes were saved.
4. Keep replies concise, warm, and actionable (2–6 short paragraphs max unless the user asks for depth).

Allowed suggestion targets:
- target "project" + field: ${[...ALLOWED_PROJECT_FIELDS].join(', ')}
- target "director" + field: ${[...ALLOWED_DIRECTOR_FIELDS].join(', ')} (director bible sub-fields)
- target "character" + field: ${[...ALLOWED_CHARACTER_FIELDS].join(', ')} — must include characterId from context (or characterName if id unknown)

Rules for suggestions:
- Only suggest when the user explicitly decides something or asks you to update a field.
- value must be the full new text for that field (for continuityMemory you may append to existing facts from context).
- rationale: one sentence why this helps the project.
- label: short human label (e.g. "Claude · Personality").
- Do not suggest empty values. Max 5 suggestions per turn.

OUTPUT FORMAT — respond with ONLY valid JSON (no markdown fences):
{
  "reply": "your conversational response to the user",
  "suggestions": [
    {
      "target": "project" | "director" | "character",
      "field": "fieldName",
      "value": "full new value",
      "label": "short label",
      "rationale": "why apply this",
      "characterId": "optional pb id",
      "characterName": "optional name"
    }
  ]
}

=== PROJECT CONTEXT ===
${ctx.projectBlock}

=== CHARACTERS ===
${ctx.charactersBlock}

=== SCENES ===
${ctx.scenesBlock}`
}

export function parseProjectGuideResponse (
  rawContent: string,
  ctx: ProjectGuideContext
): { reply: string; suggestions: GuideSuggestion[] } {
  const obj = extractJsonObject(rawContent)
  if (!obj) {
    const fallback = rawContent.trim()
    return { reply: fallback || 'I could not parse a response. Try again.', suggestions: [] }
  }

  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : ''
  const rawSuggestions = Array.isArray(obj.suggestions) ? obj.suggestions : []

  const suggestions: GuideSuggestion[] = []
  let idx = 0
  for (const item of rawSuggestions) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const target = o.target === 'project' || o.target === 'director' || o.target === 'character'
      ? o.target
      : null
    const field = typeof o.field === 'string' ? o.field.trim() : ''
    const value = typeof o.value === 'string' ? o.value.trim() : ''
    if (!target || !field || !value) continue

    if (target === 'project' && !ALLOWED_PROJECT_FIELDS.has(field)) continue
    if (target === 'director' && !ALLOWED_DIRECTOR_FIELDS.has(field)) continue
    if (target === 'character' && !ALLOWED_CHARACTER_FIELDS.has(field)) continue

    let characterId = typeof o.characterId === 'string' ? o.characterId.trim() : ''
    const characterName = typeof o.characterName === 'string' ? o.characterName.trim() : ''
    if (target === 'character') {
      if (!characterId && characterName) {
        characterId = ctx.characterIdsByName.get(normalizeName(characterName)) || ''
      }
      if (!characterId) continue
    }

    const labelKey = target === 'director' ? `director.${field}` : field
    const defaultLabel = GUIDE_FIELD_LABELS[labelKey] || field
    const label =
      typeof o.label === 'string' && o.label.trim()
        ? o.label.trim().slice(0, 120)
        : characterName
          ? `${characterName} · ${defaultLabel}`
          : defaultLabel

    suggestions.push({
      id: `s${Date.now().toString(36)}${idx++}`,
      target,
      field,
      value: value.slice(0, target === 'character' ? 10000 : 50000),
      label,
      rationale: typeof o.rationale === 'string' ? o.rationale.trim().slice(0, 500) : '',
      characterId: characterId || undefined,
      characterName: characterName || undefined
    })
    if (suggestions.length >= 5) break
  }

  return {
    reply: reply || 'Done.',
    suggestions
  }
}
