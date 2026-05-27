import { OPENROUTER_ENRICH_MS, OPENROUTER_THREE_ACT_MS } from '~/lib/script-wizard-timeouts'
import { filterCastCharacterRows, isMetaCastCharacterEntry } from '~/lib/screenplay-character-filter'
import { defaultDirector } from '~/lib/director-presets'
import { fetchWithTimeout } from '~/server/utils/fetch-with-timeout'
import type { ProjectDirector } from '~/types/creative-project'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { OPENROUTER_TEXT_MODEL_MAP } from '~/server/utils/openrouter-text-models'

export interface ComparableFilm {
  title: string
  year: string
  parallel: string
  contrast: string
}

export interface ScriptAiEnrichment {
  /** Short pitch (2–4 sentences) — shown before the full synopsis. */
  logline: string
  /** ~1 page narrative synopsis (prose, not a beat sheet). */
  onePageSynopsis: string
  /** 3–5 reference films for creative development. */
  comparableFilms: ComparableFilm[]
  /** Deeper read on what the story is about, motifs, audience takeaway. */
  themeExploration: string
  /** Kept for list cards / quick metadata (often mirrors logline opening). */
  summary: string
  genre: string
  tone: string
  themes: string[]
  sceneSummaries: { index: number; summary: string }[]
  characterRoles: { name: string; role_description: string }[]
}

/** OpenRouter / Anthropic often return `message.content` as a string OR an array of parts. */
function normalizeOpenRouterAssistantText (raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return ''
  const parts: string[] = []
  for (const part of raw) {
    if (typeof part === 'string') {
      parts.push(part)
      continue
    }
    if (!part || typeof part !== 'object') continue
    const p = part as Record<string, unknown>
    if (typeof p.text === 'string') parts.push(p.text)
    else if (typeof p.content === 'string') parts.push(p.content)
  }
  return parts.join('')
}

/** Strip a leading ``` / ```json fence so JSON.parse can run (Claude often wraps JSON). */
/** Some models prepend reasoning blocks before JSON. */
function stripThinkingAndToolTags (text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
}

function stripLeadingAssistantCodeFence (text: string): string {
  const t = text.trim()
  if (!t.startsWith('```')) return t
  const lines = t.split('\n')
  if (lines.length < 2) return t
  lines.shift()
  if (lines.length && lines[lines.length - 1].trim() === '```') {
    lines.pop()
  } else if (lines.length && lines[lines.length - 1].trim().endsWith('```')) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/```\s*$/, '').trimEnd()
  }
  return lines.join('\n').trim()
}

function extractJsonObject (text: string): Record<string, unknown> | null {
  const cleaned = stripLeadingAssistantCodeFence(stripThinkingAndToolTags(text)).trim()
  const tryParseObject = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s) as unknown
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    } catch {
      /* try next */
    }
    return null
  }
  const direct = tryParseObject(cleaned)
  if (direct) return direct
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  return tryParseObject(cleaned.slice(start, end + 1))
}

function asStr (v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStrArr (v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean)
}

function parseComparableFilms (v: unknown): ComparableFilm[] {
  if (!Array.isArray(v)) return []
  const out: ComparableFilm[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const title = asStr(o.title)
    if (!title) continue
    out.push({
      title,
      year: asStr(o.year),
      parallel: asStr(o.parallel) || asStr(o.similarity) || asStr(o.comparison),
      contrast: asStr(o.contrast) || asStr(o.difference)
    })
  }
  return out.slice(0, 8)
}

function buildSynopsisField (logline: string, onePage: string): string {
  const L = logline.trim()
  const P = onePage.trim()
  if (L && P) return `${L}\n\n${P}`
  return L || P || ''
}

function buildTreatmentFromScriptRead (e: {
  themeExploration: string
  themes: string[]
  tone: string
  genre: string
}): string {
  const lines: string[] = [
    'Script analysis (cold read)',
    '',
    'This section summarizes the uploaded screenplay as written. It does not add plot, characters, comparable titles, or story beats that are not on the page.',
    ''
  ]
  const genre = e.genre.trim()
  const tone = e.tone.trim()
  if (genre || tone) {
    lines.push('Tone and genre (from the script)')
    if (genre) lines.push(`Genre: ${genre}`)
    if (tone) lines.push(`Tone: ${tone}`)
    lines.push('')
  }
  if (e.themes.length) {
    lines.push('Themes (supported by the text)')
    for (const t of e.themes) {
      lines.push(`• ${t}`)
    }
    lines.push('')
  }
  lines.push('Observations')
  lines.push('')
  lines.push(e.themeExploration.trim() || '(No observations returned — run analysis again.)')
  return lines.join('\n').trim()
}

function fallbackEnrichment (input: { projectName: string; characterNames: string[] }): ScriptAiEnrichment {
  const stub = `Imported project: ${input.projectName}`
  return {
    logline: stub,
    onePageSynopsis: '',
    comparableFilms: [],
    themeExploration: '',
    summary: stub,
    genre: 'unknown',
    tone: 'unknown',
    themes: [],
    sceneSummaries: [],
    characterRoles: input.characterNames.map(name => ({
      name,
      role_description: 'Imported from script; details to be expanded.'
    }))
  }
}

/**
 * One OpenRouter call: parsed-script metadata + one-page synopsis, comps, and theme pass.
 */
export async function enrichScriptWithAi (input: {
  projectName: string
  sceneOutline: string
  characterNames: string[]
  openrouterModelId?: string
}): Promise<ScriptAiEnrichment> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return fallbackEnrichment(input)
  }

  try {
  const system = `You are a script coverage reader doing a COLD READ of an uploaded screenplay. Your job is to understand and report what the author wrote — not to repitch, improve, or reimagine the story.

Reply with ONLY valid JSON (no markdown code fences), shape:
{
  "logline": "2–4 sentences: factual summary of who, where, and what conflict exists AS WRITTEN in the scenes (no marketing spin, no invented stakes).",
  "one_page_synopsis": "Neutral prose (~350–650 words) recounting the story events in order as they appear in the script. Present tense. Do not add scenes, twists, characters, or an ending that is not in the material. No scene numbers.",
  "comparable_films": [],
  "theme_exploration": "2–4 short paragraphs (plain text, use \\n\\n between paragraphs). Tone, motifs, and subtext that are supported by dialogue and action in the script. If something is inference, say so briefly; do not present guesses as plot facts.",
  "genre": "primary genre label implied by the script",
  "tone": "short tone description grounded in how the script reads on the page",
  "themes": ["theme1","theme2"],
  "sceneSummaries": [{"index":0,"summary":"one line — only this scene's events"}, ...],
  "characterRoles": [{"name":"EXACT_NAME","role_description":"one or two sentences from script evidence only"}, ...]
}
COLD READ RULES (strict):
- Do NOT invent plot events, relationships, twists, dialogue, or endings absent from the supplied scenes.
- Do NOT change the author's intent, "elevate" the premise, or suggest what the story should be.
- comparable_films must be an empty array [] — do not name other movies unless the screenplay text explicitly references them.
- sceneSummaries: one row per scene in the list below, same order and index (0 = first scene). Summarize only what happens in that scene block.
- characterRoles: include every name from the provided list; use EXACT spelling; describe only what the script shows or states.
- Never use CAST, CREDITS, or section headings as character names.
- Escape quotes inside JSON strings properly.`

  const user = `Working title (file/project label — not necessarily the script's title card): ${input.projectName}

Character names detected in the screenplay (use exactly these in characterRoles):
${input.characterNames.join(', ') || '(none detected)'}

Screenplay material (scene headings and excerpts — your only source of truth):
${input.sceneOutline.slice(0, 48_000)}`

  const body = buildOpenRouterChatCompletionBody({
    model: input.openrouterModelId || 'openai/gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.2,
    max_tokens: 2400
  })

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aielegance.com',
        'X-Title': 'AI Elegance Script Import'
      },
      body: JSON.stringify(body)
    },
    OPENROUTER_ENRICH_MS
  )

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] OpenRouter error:', res.status, raw.slice(0, 500))
    let detail = `OpenRouter request failed (${res.status})`
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: unknown }; message?: unknown }
      const msg =
        (parsed && parsed.error && typeof parsed.error.message === 'string' && parsed.error.message.trim())
        || (parsed && typeof parsed.message === 'string' && parsed.message.trim())
        || ''
      if (msg) detail = msg
    } catch {
      if (raw.trim()) detail = `${detail}: ${raw.trim().slice(0, 200)}`
    }
    throw new Error(detail)
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    content = normalizeOpenRouterAssistantText(j.choices?.[0]?.message?.content)
  } catch {
    return fallbackEnrichment(input)
  }

  const parsed = extractJsonObject(content)
  if (!parsed) {
    const fb = fallbackEnrichment(input)
    const salvage = content.trim().slice(0, 2000)
    if (salvage.length > 80) {
      fb.summary = salvage
      fb.logline = salvage.split(/\n\n|\n/).find(l => l.trim().length > 0)?.trim().slice(0, 500) || salvage.slice(0, 500)
    }
    fb.onePageSynopsis = ''
    return fb
  }

  const sceneSummaries: { index: number; summary: string }[] = []
  const ss = parsed.sceneSummaries ?? parsed.scene_summaries
  if (Array.isArray(ss)) {
    for (const row of ss) {
      if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>
        const idx = typeof o.index === 'number' ? o.index : Number(o.index)
        sceneSummaries.push({
          index: Number.isFinite(idx) ? idx : sceneSummaries.length,
          summary: asStr(o.summary)
        })
      }
    }
  }

  const characterRoles: { name: string; role_description: string }[] = []
  const cr = parsed.characterRoles ?? parsed.character_roles
  if (Array.isArray(cr)) {
    for (const row of cr) {
      if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>
        const name = asStr(o.name)
        if (name) {
          characterRoles.push({
            name,
            role_description: asStr(o.role_description) || 'Character from script.'
          })
        }
      }
    }
  }

  for (const name of input.characterNames) {
    if (!characterRoles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      characterRoles.push({
        name,
        role_description: 'Imported from script; details to be expanded.'
      })
    }
  }

  const legacySummary = asStr(parsed.summary)
  const logline =
    asStr(parsed.logline) ||
    legacySummary.split(/\n\n|\n/).find(l => l.trim().length > 0)?.trim().slice(0, 500) ||
    ''
  let onePageSynopsis =
    asStr(parsed.one_page_synopsis) ||
    asStr(parsed.onePageSynopsis) ||
    asStr(parsed.synopsis_page) ||
    asStr(parsed.synopsis) ||
    asStr(parsed.full_synopsis) ||
    asStr(parsed.narrative_synopsis) ||
    asStr(parsed.story_synopsis) ||
    asStr(parsed.screenplay_synopsis) ||
    asStr(parsed.overview) ||
    asStr(parsed.story) ||
    ''
  if (!onePageSynopsis && legacySummary.length > 200) {
    onePageSynopsis = logline && legacySummary.startsWith(logline) ? legacySummary.slice(logline.length).trim() : legacySummary
  }
  // Cold read: never attach AI-suggested comparable titles to project import analyze.
  const comparableFilms: ComparableFilm[] = []
  const themeExploration =
    asStr(parsed.theme_exploration) ||
    asStr(parsed.themeExploration) ||
    ''

  const genre = asStr(parsed.genre) || 'unknown'
  const tone = asStr(parsed.tone) || 'unknown'
  const themes = asStrArr(parsed.themes)
  const summary =
    logline.slice(0, 500) ||
    onePageSynopsis.slice(0, 400) ||
    `Imported project: ${input.projectName}`

  return {
    logline: logline || summary,
    onePageSynopsis,
    comparableFilms,
    themeExploration,
    summary,
    genre,
    tone,
    themes,
    sceneSummaries,
    characterRoles: filterCastCharacterRows(characterRoles)
  }
  } catch (err: unknown) {
    console.warn('[script-import-ai] enrichScriptWithAi failed:', err)
    return fallbackEnrichment(input)
  }
}

/** Map AI enrichment to DB fields (synopsis + treatment prose). */
export function enrichmentToProjectFields (e: ScriptAiEnrichment): {
  synopsis: string
  treatment: string
} {
  const synopsis =
    buildSynopsisField(e.logline, e.onePageSynopsis) || e.summary
  const treatment = buildTreatmentFromScriptRead({
    themeExploration: e.themeExploration,
    themes: e.themes,
    tone: e.tone,
    genre: e.genre
  })
  return { synopsis, treatment }
}

/**
 * True if preview/compare should show this model’s result (not only the mapped synopsis string).
 * Models differ: some put prose in logline + one_page_synopsis, others in theme_exploration only;
 * checking synopsis length alone rejects valid outputs.
 */
export function scriptPreviewEnrichmentIsUsable (
  enrichment: ScriptAiEnrichment,
  prose: { synopsis: string; treatment: string }
): boolean {
  const g = String(enrichment.genre || '').trim().toLowerCase()
  const t = String(enrichment.tone || '').trim().toLowerCase()
  const syn = prose.synopsis.trim()
  const fromScenes = enrichment.sceneSummaries?.map(s => s.summary).filter(Boolean).join(' ') || ''
  const block = [
    enrichment.logline,
    enrichment.onePageSynopsis,
    syn,
    enrichment.themeExploration,
    fromScenes
  ]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n')
  const flat = block.replace(/\s+/g, ' ').trim()
  // Accept first: models often leave logline/synopsis empty but fill theme_exploration,
  // comparable_films, or sceneSummaries. The synopsis field can still be the internal
  // "Imported project: …" filler — do not treat that as a stub when the rest is substantive.
  if (flat.length >= 28) return true

  const looksLikeStub =
    (g === 'unknown' || !g) &&
    (t === 'unknown' || !t) &&
    syn.toLowerCase().startsWith('imported project:')
  if (looksLikeStub) return false
  if ((g && g !== 'unknown') || (t && t !== 'unknown')) {
    return flat.length >= 10
  }
  return flat.length >= 16
}

/** For Script Wizard phase 1 + OMDb: structured comps before treatment prose exists. */
export function comparableTitlesFromEnrichment (e: ScriptAiEnrichment): Array<{ title: string; year?: string }> {
  return e.comparableFilms.slice(0, 8).map(f => ({
    title: f.title,
    year: f.year?.trim() ? f.year.trim() : undefined
  }))
}

/**
 * Optional Script Wizard pass: map the story into a practical three-act thematic lens.
 * Returns markdown-like plain text section suitable for appending to treatment notes.
 */
export async function inferThreeActThemeBreakdown (input: {
  projectName: string
  logline: string
  onePageSynopsis: string
  themeExploration: string
  sceneOutline: string
  openrouterModelId?: string
}): Promise<string> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return ''

  const system = `You are a script supervisor mapping an uploaded screenplay into three acts for production breakdown.

Reply with ONLY valid JSON:
{
  "act_1": "3–6 bullet lines: setup beats that occur in the script (use neutral coverage language).",
  "act_2": "4–8 bullet lines: escalation and midpoint pressure as written — no invented set pieces.",
  "act_3": "3–6 bullet lines: climax and resolution only if present in the material; otherwise note what the script actually ends on.",
  "theme_arc": "1 short paragraph on how tone/theme shifts across acts, citing patterns from the text (not a new story)."
}
Rules:
- COLD READ: every bullet must correspond to events in the scene outline / screenplay excerpt — do not add plot, characters, or twists the author did not write.
- Choose act breaks at the script's own turning points when visible; if ambiguous, state the closest split without inventing a missing climax.
- Do not reference other films or suggest changes to the story.
- Escape quotes in JSON strings.`

  const user = `Working title: ${input.projectName}

Coverage synopsis (secondary context — prefer the scene material below if they disagree):
${[input.logline, input.onePageSynopsis].filter(Boolean).join('\n\n').slice(0, 6000)}

Observations from coverage:
${input.themeExploration.slice(0, 3000)}

Screenplay scene material (primary source — map acts from this):
${input.sceneOutline.slice(0, 48_000)}`

  const model = input.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.2,
    max_tokens: 2200
  })

  try {
    const res = await fetchWithTimeout(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aielegance.com',
          'X-Title': 'AI Elegance Script Wizard Acts'
        },
        body: JSON.stringify(body)
      },
      OPENROUTER_THREE_ACT_MS
    )
    const raw = await res.text()
    if (!res.ok) return ''
    const parsedOuter = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
    const content = parsedOuter.choices?.[0]?.message?.content || ''
    const parsed = extractJsonObject(content)
    if (!parsed) return ''

    const act1 = asStr(parsed.act_1 || parsed.act1 || parsed['Act I']).trim()
    const act2 = asStr(parsed.act_2 || parsed.act2 || parsed['Act II']).trim()
    const act3 = asStr(parsed.act_3 || parsed.act3 || parsed['Act III']).trim()
    const arc = asStr(parsed.theme_arc || parsed.themeArc).trim()
    if (!act1 && !act2 && !act3 && !arc) return ''

    const lines: string[] = [
      'Three-act thematic breakdown',
      '',
      'Mapped from the uploaded screenplay (cold read — beats are from the author’s script, not invented).',
      ''
    ]
    if (act1) lines.push('Act I', act1, '')
    if (act2) lines.push('Act II', act2, '')
    if (act3) lines.push('Act III', act3, '')
    if (arc) {
      lines.push('Theme arc', arc)
    }
    return lines.join('\n').trim()
  } catch {
    return ''
  }
}

function mergeDirectorParsed (raw: Record<string, unknown> | null): ProjectDirector {
  const d = defaultDirector()
  if (!raw) return d
  const pick = (k: keyof ProjectDirector, ...alts: string[]) => {
    for (const key of [k, ...alts]) {
      const v = raw[key]
      if (typeof v === 'string' && v.trim()) {
        d[k] = v.trim()
        return
      }
    }
  }
  pick('name', 'director_name', 'label')
  pick('style', 'visual_style', 'aesthetic')
  pick('tone', 'emotional_tone', 'mood')
  pick('camera_preferences', 'camera', 'lenses', 'coverage')
  pick('lighting_style', 'lighting')
  pick('pacing', 'rhythm', 'edit_pacing')
  return d
}

/**
 * Second pass after synopsis/treatment enrichment: Claude infers a rich director bible
 * (style, tone, camera, lighting, pacing) tailored to this script.
 */
export async function inferDirectorFromImportedScript (input: {
  projectName: string
  logline: string
  onePageSynopsis: string
  genre: string
  tone: string
  themes: string[]
  sceneOutline: string
  characterNames: string[]
  openrouterModelId?: string
}): Promise<ProjectDirector> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return defaultDirector()
  }

  const system = `You document how this screenplay already reads on the page — for continuity with the writer’s intent, not a creative relaunch.

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "name": "Short label for the script’s existing feel (e.g. 'Sunlit domestic warmth') — not a real person's name unless the script names one.",
  "style": "2–4 sentences: visual/staging qualities implied by sluglines, action lines, and settings in the excerpt (what is explicit vs sparse).",
  "tone": "2–3 sentences: emotional register and performance temperature supported by dialogue and action — how it should feel when shot faithfully.",
  "camera_preferences": "2–4 sentences: coverage implied by how scenes are written (intimacy, scope, movement) — do not impose a style absent from the text.",
  "lighting_style": "2–3 sentences: day/night, interior/exterior, and mood cues stated or strongly implied in the script.",
  "pacing": "2–3 sentences: rhythm of scenes and dialogue as written; when the script holds vs accelerates."
}
Rules:
- COLD READ: infer only from supplied scene material; do not invent genre mash-ups, new subplots, or a different ending.
- If the script is minimal on visual detail, say so and stick to what is on the page.
- Escape quotes inside JSON strings properly.`

  const synopsisBlock = [input.logline.trim(), input.onePageSynopsis.trim()]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000)

  const user = `Working title: ${input.projectName}

Screenplay scene material (primary source):
${input.sceneOutline.slice(0, 48_000)}

Genre (from coverage): ${input.genre}
Tone tag (from coverage): ${input.tone}
Themes: ${input.themes.length ? input.themes.join(', ') : '(none listed)'}

Characters: ${input.characterNames.join(', ') || '(none listed)'}

Synopsis / logline (secondary — if this conflicts with the scenes above, follow the script):
${synopsisBlock || '(none)'}`

  const model = input.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.25,
    max_tokens: 2048
  })

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aielegance.com',
        'X-Title': 'AI Elegance Script Import Director'
      },
      body: JSON.stringify(body)
    },
    OPENROUTER_ENRICH_MS
  )

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] Director OpenRouter error:', res.status, raw.slice(0, 400))
    return defaultDirector()
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return defaultDirector()
  }

  const parsed = extractJsonObject(content)
  return mergeDirectorParsed(parsed)
}

/** Parsed script + optional GPT hints — used when Claude character pass fails. */
export interface ParsedScriptForCharacters {
  scenes: { body: string }[]
  characterNames: string[]
}

export interface CharacterWithShare {
  name: string
  role_description: string
  screen_share_percent: number
}

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when stored shares are all zero, or every row is ~the same % (useless for the pie).
 */
function shouldReplaceFlatDistribution (rows: CharacterWithShare[]): boolean {
  if (rows.length < 2) return false
  const vals = rows.map((r) => {
    const p = r.screen_share_percent
    const n = typeof p === 'number' ? p : Number(p)
    return Number.isFinite(n) ? Math.max(0, n) : 0
  })
  const sum = vals.reduce((a, b) => a + b, 0)
  if (sum <= 0) return true
  const mean = sum / vals.length
  return vals.every(v => Math.abs(v - mean) < 1)
}

/**
 * Rough dialogue/presence proxy: count case-insensitive whole-word mentions in the script excerpt.
 */
function applyMentionBasedSharesFromScript (
  scriptText: string,
  rows: CharacterWithShare[]
): CharacterWithShare[] {
  if (!rows.length || !scriptText.trim()) return rows
  const counts = rows.map((r) => {
    const n = r.name.trim()
    if (!n) return { row: r, count: 0 }
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, 'gi')
    const m = scriptText.match(re)
    return { row: r, count: m ? m.length : 0 }
  })
  const total = counts.reduce((s, x) => s + x.count, 0)
  if (total <= 0) return rows
  return counts.map(({ row, count }) => ({
    ...row,
    screen_share_percent: (100 * count) / total
  }))
}

/**
 * Deduplicate by name, scale shares to sum 100, fix float drift on last item.
 */
export function normalizeCharacterShares (rows: CharacterWithShare[]): CharacterWithShare[] {
  const byKey = new Map<string, CharacterWithShare>()
  for (const r of rows) {
    const n = r.name.trim()
    if (!n || isMetaCastCharacterEntry(n, r.role_description)) continue
    const k = n.toLowerCase()
    const pct = typeof r.screen_share_percent === 'number' && Number.isFinite(r.screen_share_percent)
      ? Math.max(0, r.screen_share_percent)
      : 0
    const desc = (r.role_description || '').trim() || 'Character from script.'
    if (!byKey.has(k)) {
      byKey.set(k, { name: n, role_description: desc, screen_share_percent: pct })
    }
  }
  const list = [...byKey.values()]
  if (!list.length) return []

  let sum = list.reduce((s, r) => s + r.screen_share_percent, 0)
  if (sum <= 0) {
    const eq = 100 / list.length
    return list.map((r, i) => ({
      ...r,
      screen_share_percent: i === list.length - 1
        ? Math.round((100 - eq * (list.length - 1)) * 10) / 10
        : Math.round(eq * 10) / 10
    }))
  }

  const scale = 100 / sum
  const scaled = list.map(r => ({
    ...r,
    screen_share_percent: Math.round(r.screen_share_percent * scale * 10) / 10
  }))
  const drift = Math.round((100 - scaled.reduce((s, r) => s + r.screen_share_percent, 0)) * 10) / 10
  if (scaled.length && Math.abs(drift) >= 0.05) {
    const last = scaled[scaled.length - 1]!
    last.screen_share_percent = Math.round((last.screen_share_percent + drift) * 10) / 10
  }
  return scaled
}

function parseCharactersArrayFromModel (content: string): Record<string, unknown>[] {
  const obj = extractJsonObject(content)
  if (obj) {
    const ch = obj.characters ?? obj.character_list ?? obj.roles
    if (Array.isArray(ch)) return ch as Record<string, unknown>[]
  }
  const i = content.indexOf('[')
  const j = content.lastIndexOf(']')
  if (i !== -1 && j > i) {
    try {
      const arr = JSON.parse(content.slice(i, j + 1))
      if (Array.isArray(arr)) return arr as Record<string, unknown>[]
    } catch {
      /* ignore */
    }
  }
  return []
}

function rowFromUnknownChar (row: Record<string, unknown>): CharacterWithShare | null {
  const name =
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.character === 'string' && row.character.trim()) ||
    ''
  if (!name) return null
  const role_description =
    asStr(row.role_description) ||
    asStr(row.description) ||
    asStr(row.bio) ||
    ''
  if (isMetaCastCharacterEntry(name, role_description)) return null
  let pct = row.screen_share_percent ?? row.screen_time_percent ?? row.share_percent ?? row.percent
  let n = typeof pct === 'number' ? pct : Number(pct)
  if (!Number.isFinite(n)) n = 0
  return {
    name: name.slice(0, 200),
    role_description: role_description.slice(0, 5000),
    screen_share_percent: n
  }
}

/**
 * Claude: named characters with descriptions + estimated screen-time share (dialogue + presence).
 */
export async function inferCharactersWithScreenShareFromScript (input: {
  projectName: string
  logline: string
  onePageSynopsis: string
  genre: string
  tone: string
  sceneOutline: string
  enrichmentHints: { name: string; role_description: string }[]
  parserCharacterNames: string[]
  openrouterModelId?: string
}): Promise<CharacterWithShare[]> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return []

  const system = `You are a screenplay analyst doing a cold read. List principal named characters present in the excerpt.

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "characters": [
    {
      "name": "EXACT name as it appears in scene text (character cue / dialogue)",
      "role_description": "2–4 sentences describing who they are and what they do AS WRITTEN — relationships and function only when supported by dialogue/action.",
      "screen_share_percent": 0
    }
  ]
}
Rules:
- screen_share_percent: estimate share of dialogue lines + meaningful presence in the excerpt (principal cast ~100 total).
- Include at most 18 rows; merge true extras into one "OTHER (extras)" row if needed with a small combined percent.
- Do not invent characters, backstory, or motivations absent from the script text.
- Never use CAST, CREDITS, ENSEMBLE, or section headings as character names.
- Escape quotes inside JSON strings properly.`

  const hints =
    input.enrichmentHints.length > 0
      ? input.enrichmentHints.map(h => `${h.name}: ${h.role_description || '(no notes)'}`).join('\n')
      : '(none)'

  const user = `Project title: ${input.projectName}

Genre: ${input.genre}
Tone: ${input.tone}

Logline / synopsis (context):
${[input.logline, input.onePageSynopsis].filter(Boolean).join('\n\n').slice(0, 6000)}

Parser-detected character names (hints, may be incomplete):
${input.parserCharacterNames.join(', ') || '(none)'}

Prior model character notes (hints):
${hints}

Script excerpt (scene headings + dialogue and action — use this to judge presence and lines):
${input.sceneOutline.slice(0, 14000)}`

  const model = input.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.35,
    max_tokens: 1200
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aielegance.com',
      'X-Title': 'AI Elegance Script Import Characters'
    },
    body: JSON.stringify(body)
  })

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] Characters OpenRouter error:', res.status, raw.slice(0, 400))
    return []
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return []
  }

  const arr = parseCharactersArrayFromModel(content)
  const out: CharacterWithShare[] = []
  for (const row of arr) {
    if (row && typeof row === 'object') {
      const r = rowFromUnknownChar(row as Record<string, unknown>)
      if (r) out.push(r)
    }
  }
  let withShares = out
  if (shouldReplaceFlatDistribution(withShares)) {
    withShares = applyMentionBasedSharesFromScript(input.sceneOutline, withShares)
  }
  return normalizeCharacterShares(filterCastCharacterRows(withShares))
}

/**
 * Claude: fill descriptions + screen-share estimates for an existing cast table (fixed names).
 * Used from the Characters tab without re-running full script import.
 */
export async function enrichFixedCharacterRosterWithAi (input: {
  projectName: string
  synopsis: string
  treatment: string
  genre: string
  tone: string
  sceneOutline: string
  characterNames: string[]
  /** Latest Director-tab bible (optional). */
  directorContext?: string
  openrouterModelId?: string
}): Promise<CharacterWithShare[]> {
  const names = input.characterNames.map(n => n.trim()).filter(Boolean)
  if (!names.length) return []

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return []

  const system = `You are a screenplay analyst and character concept prompt writer. The project already has a fixed cast list (exact names below). For EACH name you must return exactly one JSON object.

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "characters": [
    {
      "name": "EXACT name from the list",
      "role_description": "2–4 sentences written as an image-generation character prompt: visual appearance, age range, wardrobe, physical details, expression/body language, and mood/tone grounded in the script and director notes. Keep it practical for concept art generation, not biography.",
      "screen_share_percent": 0
    }
  ]
}

Rules:
- Include every name from the provided list exactly once. Use the same spelling as in the list (preserve capitalization from the list).
- role_description should prioritize how the character should look and feel on screen (casting/wardrobe/visual tone cues). Avoid plot-summary language unless needed for visual direction.
- screen_share_percent: estimate this character’s share of all dialogue in the script excerpt (lines/cues), plus meaningful on-page presence where relevant; across the list these should sum to about 100.
- Do not add characters not in the list. Do not omit any list name.
- Escape quotes inside JSON strings properly.`

  const dir = (input.directorContext || '').trim()
  const user = `Project title: ${input.projectName}

Genre: ${input.genre || '(unspecified)'}
Tone: ${input.tone || '(unspecified)'}

${dir ? `Director bible (honor this when writing visual look-and-feel prompts):\n${dir.slice(0, 4000)}\n\n` : ''}Synopsis and treatment (context):
${[input.synopsis, input.treatment].filter(Boolean).join('\n\n').slice(0, 8000)}

Fixed cast — return exactly one row per line (same name strings):
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Script excerpt (scene headings + action and dialogue — use this to infer visual design and percentages):
${input.sceneOutline.slice(0, 14000)}`

  const model = input.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.35,
    max_tokens: 8192
  })

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aielegance.com',
        'X-Title': 'AI Elegance Cast Table Enrich'
      },
      body: JSON.stringify(body)
    },
    OPENROUTER_ENRICH_MS
  )

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] Cast enrich OpenRouter error:', res.status, raw.slice(0, 400))
    return []
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return []
  }

  const arr = parseCharactersArrayFromModel(content)
  const byNorm = new Map<string, CharacterWithShare>()
  for (const row of arr) {
    if (row && typeof row === 'object') {
      const r = rowFromUnknownChar(row as Record<string, unknown>)
      if (r) byNorm.set(r.name.trim().toLowerCase(), r)
    }
  }

  const ordered: CharacterWithShare[] = []
  for (const n of names) {
    const hit = byNorm.get(n.trim().toLowerCase())
    if (hit) {
      ordered.push({
        name: n.slice(0, 200),
        role_description: hit.role_description.slice(0, 5000),
        screen_share_percent: hit.screen_share_percent
      })
    }
  }
  let finalRows = ordered
  if (shouldReplaceFlatDistribution(finalRows)) {
    finalRows = applyMentionBasedSharesFromScript(input.sceneOutline, finalRows)
  }
  return normalizeCharacterShares(finalRows)
}

export function buildCharacterRowsFromFallback (input: {
  enrichmentRoles: { name: string; role_description: string }[]
  parsed: ParsedScriptForCharacters
}): CharacterWithShare[] {
  const bodies = input.parsed.scenes.map(s => s.body).join('\n\n')
  let roles = filterCastCharacterRows(input.enrichmentRoles.filter(r => r.name.trim()))
  if (!roles.length) {
    roles = input.parsed.characterNames
      .filter(Boolean)
      .map(name => ({
        name: name.trim(),
        role_description: 'Detected in script; add notes on the Characters tab.'
      }))
  }
  if (!roles.length) return []

  const counts = new Map<string, number>()
  for (const r of roles) {
    const n = r.name.trim()
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, 'gi')
    const m = bodies.match(re)
    counts.set(n.toLowerCase(), m ? m.length : 0)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const rows: CharacterWithShare[] = roles.map(r => {
    const n = r.name.trim()
    const c = counts.get(n.toLowerCase()) ?? 0
    const pct = total > 0 ? (100 * c) / total : 100 / roles.length
    return {
      name: n,
      role_description: r.role_description.trim() || 'Character from script.',
      screen_share_percent: pct
    }
  })
  return normalizeCharacterShares(rows)
}

/** Scenes Claude proposes for import (replaces parser slugs when valid). */
export interface InferredImportScene {
  heading: string
  summary: string
  body: string
}

const MAX_INFERRED_SCENES = 40
const MAX_SCRIPT_CHARS_FOR_SCENES = 180_000

function parseScenesArrayFromModel (content: string): Record<string, unknown>[] {
  const obj = extractJsonObject(content)
  if (obj) {
    const sc = obj.scenes ?? obj.scene_breakdown ?? obj.sequence
    if (Array.isArray(sc)) return sc as Record<string, unknown>[]
  }
  const i = content.indexOf('[')
  const j = content.lastIndexOf(']')
  if (i !== -1 && j > i) {
    try {
      const arr = JSON.parse(content.slice(i, j + 1))
      if (Array.isArray(arr)) return arr as Record<string, unknown>[]
    } catch {
      /* ignore */
    }
  }
  return []
}

function rowFromSceneUnknown (row: Record<string, unknown>): InferredImportScene | null {
  const heading =
    asStr(row.heading) ||
    asStr(row.slugline) ||
    asStr(row.scene_heading) ||
    asStr(row.scene) ||
    ''
  const summary = asStr(row.summary) || asStr(row.one_line) || asStr(row.beat) || ''
  const body =
    asStr(row.body) ||
    asStr(row.script_excerpt) ||
    asStr(row.content) ||
    asStr(row.text) ||
    ''
  const b = body.trim()
  if (!b) return null
  return {
    heading: (heading.trim() || 'Scene').slice(0, 500),
    summary: (summary.trim() || heading.trim() || 'Story beat').slice(0, 2000),
    body: b.slice(0, 100_000)
  }
}

export function normalizeInferredImportScenes (rows: InferredImportScene[]): InferredImportScene[] {
  const out: InferredImportScene[] = []
  for (const s of rows) {
    const body = s.body.trim()
    if (!body) continue
    out.push({
      heading: (s.heading.trim() || `Scene ${out.length + 1}`).slice(0, 500),
      summary: (s.summary.trim() || s.heading.trim() || 'Beat').slice(0, 2000),
      body: body.slice(0, 100_000)
    })
    if (out.length >= MAX_INFERRED_SCENES) break
  }
  return out
}

/**
 * Claude: narrative/production scene breakdown with script excerpts per scene (for Scenes + Storyboard).
 */
export async function inferScenesFromScriptWithClaude (input: {
  projectName: string
  genre: string
  tone: string
  characterNames: string[]
  fullScriptText: string
  /** Director-tab notes — influences scene boundaries and emphasis. */
  directorContext?: string
  openrouterModelId?: string
}): Promise<InferredImportScene[]> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return []

  const script = input.fullScriptText.trim().slice(0, MAX_SCRIPT_CHARS_FOR_SCENES)
  if (!script) return []

  const sceneBand =
    script.length < 4000 ? '1–8' : script.length < 20000 ? 'about 4–18' : 'about 8–36'

  const system = `You are a storyboard supervisor and assistant director. Read the screenplay and break it into SCENES that work for storyboarding: each scene is one continuous time/place/beat (or one clear montage unit).

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "scenes": [
    {
      "heading": "Production-style slug, e.g. INT. KITCHEN – DAY",
      "summary": "One or two sentences: dramatic goal of this beat, who drives it.",
      "body": "Script excerpt for this scene ONLY — copy verbatim from the screenplay supplied (character names, dialogue, action lines). You may trim adjacent blank lines but do not paraphrase dialogue."
    }
  ]
}
Rules:
- "body" must be copied from the supplied screenplay only (no invented dialogue).
- Merge consecutive sluglines when it is clearly the same uninterrupted moment; split on location/time changes or major turns.
- Include enough body text that a storyboard artist can plan coverage (not a single line unless the beat is truly one line).
- Order must follow the screenplay. Aim for ${sceneBand} scenes when the material supports it; fewer is fine for very short scripts.
- Hard maximum ${MAX_INFERRED_SCENES} scenes.
- Escape quotes inside JSON strings properly.`

  const dir = (input.directorContext || '').trim()
  const user = `Project: ${input.projectName}
Genre hint: ${input.genre}
Tone hint: ${input.tone}

${dir ? `Director priorities (use when choosing scene splits and emphasis):\n${dir.slice(0, 4000)}\n\n` : ''}Character names (hints): ${input.characterNames.join(', ') || '(none)'}

FULL SCREENPLAY:
${script}`

  const model = input.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude
  const chatBody = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.25,
    max_tokens: 16_384
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aielegance.com',
      'X-Title': 'AI Elegance Scene Breakdown'
    },
    body: JSON.stringify(chatBody)
  })

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] Scenes OpenRouter error:', res.status, raw.slice(0, 400))
    return []
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return []
  }

  const arr = parseScenesArrayFromModel(content)
  const rawScenes: InferredImportScene[] = []
  for (const row of arr) {
    if (row && typeof row === 'object') {
      const r = rowFromSceneUnknown(row as Record<string, unknown>)
      if (r) rawScenes.push(r)
    }
  }

  const norm = normalizeInferredImportScenes(rawScenes)
  if (norm.length < 1) return []
  if (script.length > 20_000 && norm.length === 1) {
    console.warn('[script-import-ai] Claude returned a single scene for a long script; using parser scenes instead.')
    return []
  }
  return norm
}
