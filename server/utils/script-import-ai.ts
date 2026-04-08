import { OPENROUTER_ENRICH_MS, OPENROUTER_THREE_ACT_MS } from '~/lib/script-wizard-timeouts'
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

function extractJsonObject (text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
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

function buildTreatmentFromCreative (films: ComparableFilm[], themeExploration: string): string {
  const lines: string[] = [
    'Imported script — creative development notes',
    '',
    'Comparable films',
    'Use these references to clarify tone, audience, and market positioning — not to copy.',
    ''
  ]
  if (!films.length) {
    lines.push('(No comparable titles extracted — add your own references in Director or Story.)', '')
  } else {
    films.forEach((f, i) => {
      const y = f.year ? ` (${f.year})` : ''
      lines.push(`${i + 1}. ${f.title}${y}`)
      if (f.parallel) lines.push(`   • In the same vein: ${f.parallel}`)
      if (f.contrast) lines.push(`   • How this script diverges: ${f.contrast}`)
      lines.push('')
    })
  }
  lines.push('Theme exploration')
  lines.push('')
  lines.push(themeExploration.trim() || '(Expand themes on the Story or Director tab.)')
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
}): Promise<ScriptAiEnrichment> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return fallbackEnrichment(input)
  }

  try {
  const system = `You are a senior film development executive and story analyst. Reply with ONLY valid JSON (no markdown code fences), shape:
{
  "logline": "2–4 sentence pitch: who wants what, obstacle, stakes.",
  "one_page_synopsis": "One page of prose (~400–650 words). Single narrative arc: world, protagonist, conflict, escalation, turn, resolution direction. Write for producers and writers — vivid but professional. No scene numbers.",
  "comparable_films": [
    {"title":"Exact Film Title","year":"YYYY","parallel":"Why it rhymes with this story (tone, structure, theme)","contrast":"How this script is distinct — avoid empty praise"}
  ],
  "theme_exploration": "3–5 short paragraphs (plain text, use \\n\\n between paragraphs). Dig into subtext: moral questions, motifs, genre expectations you subvert or embrace, who the story is for emotionally.",
  "genre": "primary genre label",
  "tone": "short tone description",
  "themes": ["theme1","theme2","theme3"],
  "sceneSummaries": [{"index":0,"summary":"one line"}, ...],
  "characterRoles": [{"name":"EXACT_NAME","role_description":"one or two sentences"}, ...]
}
Rules:
- Include 3–5 comparable_films (well-known, real titles). Be specific on parallel vs contrast.
- Use the same scene order as given (index 0 = first scene). Include every character name from the provided list in characterRoles (infer role from context).
- Escape quotes inside JSON strings properly.`

  const user = `Project title: ${input.projectName}

Characters seen: ${input.characterNames.join(', ') || '(none detected)'}

Scene list (numbered):
${input.sceneOutline.slice(0, 12000)}`

  const body = buildOpenRouterChatCompletionBody({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.55,
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
        'X-Title': 'AI Elegance Script Import'
      },
      body: JSON.stringify(body)
    },
    OPENROUTER_ENRICH_MS
  )

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] OpenRouter error:', res.status, raw.slice(0, 500))
    return fallbackEnrichment(input)
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return fallbackEnrichment(input)
  }

  const parsed = extractJsonObject(content)
  if (!parsed) {
    const fb = fallbackEnrichment(input)
    fb.summary = content.slice(0, 500) || fb.summary
    fb.logline = fb.summary
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
  const cr = parsed.characterRoles
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
    ''
  if (!onePageSynopsis && legacySummary.length > 200) {
    onePageSynopsis = logline && legacySummary.startsWith(logline) ? legacySummary.slice(logline.length).trim() : legacySummary
  }
  const comparableFilms = parseComparableFilms(parsed.comparable_films ?? parsed.comparableFilms)
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
    characterRoles
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
  const treatment = buildTreatmentFromCreative(e.comparableFilms, e.themeExploration)
  return { synopsis, treatment }
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
}): Promise<string> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return ''

  const system = `You are a film story consultant focused on thematic analysis.
Reply with ONLY valid JSON:
{
  "act_1": "3-6 bullet-style lines: setup, world, thematic question posed.",
  "act_2": "4-8 bullet-style lines: escalation, midpoint pressure, theme under stress.",
  "act_3": "3-6 bullet-style lines: climax/resolution and thematic payoff.",
  "theme_arc": "1 short paragraph on how the core theme evolves across all three acts."
}
Rules:
- Keep each act practical and specific to this script.
- Avoid screenplay formatting jargon where possible.
- Escape quotes in JSON strings.`

  const user = `Project: ${input.projectName}

Logline:
${input.logline.slice(0, 1200)}

Synopsis:
${input.onePageSynopsis.slice(0, 5000)}

Theme exploration notes:
${input.themeExploration.slice(0, 4000)}

Scene outline:
${input.sceneOutline.slice(0, 10000)}`

  const model = OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.4,
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
      'Act I',
      act1 || '(No details returned.)',
      '',
      'Act II',
      act2 || '(No details returned.)',
      '',
      'Act III',
      act3 || '(No details returned.)'
    ]
    if (arc) {
      lines.push('', 'Theme arc', arc)
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
}): Promise<ProjectDirector> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return defaultDirector()
  }

  const system = `You are an experienced film director and cinematographer. Given story material from an imported screenplay, propose a cohesive director bible for the project.

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "name": "Short label for this approach (e.g. 'Grounded intimacy' or 'High-contrast thriller') — not a real person's name unless the script names one.",
  "style": "2–4 sentences: overall visual and storytelling approach, blocking, production design sensibility.",
  "tone": "2–3 sentences: emotional register, audience experience, performance direction (distinct from genre — how it should feel).",
  "camera_preferences": "2–4 sentences: focal lengths, movement, coverage philosophy, aspect-ratio-aware if relevant.",
  "lighting_style": "2–3 sentences: key/fill/ratio, color temperature, practicals vs studio, night vs day bias from the script.",
  "pacing": "2–3 sentences: scene rhythm, cutting philosophy, when to hold vs accelerate — tied to the story's beats."
}
Rules:
- Ground every field in the supplied synopsis and scene samples; be specific, not generic platitudes.
- Each string should be usable as production guidance (concrete, visual).
- Escape quotes inside JSON strings properly.`

  const synopsisBlock = [input.logline.trim(), input.onePageSynopsis.trim()]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000)

  const user = `Project title: ${input.projectName}

Genre (hint): ${input.genre}
Tone tag (hint): ${input.tone}
Themes: ${input.themes.length ? input.themes.join(', ') : '(none listed)'}

Characters: ${input.characterNames.join(', ') || '(none listed)'}

Synopsis / logline material:
${synopsisBlock || '(none)'}

Excerpted scene structure and dialogue samples (for visual and pacing cues):
${input.sceneOutline.slice(0, 12000)}`

  const model = OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.45,
    max_tokens: 2048
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aielegance.com',
      'X-Title': 'AI Elegance Script Import Director'
    },
    body: JSON.stringify(body)
  })

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
    if (!n) continue
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
}): Promise<CharacterWithShare[]> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return []

  const system = `You are a screenplay analyst. From the script material, list the principal named characters (speaking roles and key non-speaking figures who drive scenes).

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "characters": [
    {
      "name": "EXACT name as it appears in scene text (character cue / dialogue)",
      "role_description": "2–4 sentences: who they are in the story, function in the plot, relationships — specific to this script.",
      "screen_share_percent": 0
    }
  ]
}
Rules:
- screen_share_percent is your estimate of each character's share of total dialogue lines + meaningful on-screen presence in the excerpt (not runtime minutes). Principal cast should sum to about 100; tiny walk-ons can be 0.5–2 or grouped.
- Include at most 18 rows; merge true extras into one "OTHER (extras)" row if needed with a small combined percent.
- Use the parser hint list and scene text — do not invent characters never present in the excerpt.
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

  const model = OPENROUTER_TEXT_MODEL_MAP.Claude
  const body = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.35,
    max_tokens: 8192
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
  return normalizeCharacterShares(withShares)
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
}): Promise<CharacterWithShare[]> {
  const names = input.characterNames.map(n => n.trim()).filter(Boolean)
  if (!names.length) return []

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return []

  const system = `You are a screenplay analyst. The project already has a fixed cast list (exact names below). For EACH name you must return exactly one JSON object.

Reply with ONLY valid JSON (no markdown fences), shape:
{
  "characters": [
    {
      "name": "EXACT name from the list",
      "role_description": "2–4 sentences: who they are in this story, relationships, dramatic function — grounded in the script excerpt and synopsis.",
      "screen_share_percent": 0
    }
  ]
}

Rules:
- Include every name from the provided list exactly once. Use the same spelling as in the list (preserve capitalization from the list).
- screen_share_percent: estimate this character’s share of all dialogue in the script excerpt (lines/cues), plus meaningful on-page presence where relevant; across the list these should sum to about 100.
- Do not add characters not in the list. Do not omit any list name.
- Escape quotes inside JSON strings properly.`

  const dir = (input.directorContext || '').trim()
  const user = `Project title: ${input.projectName}

Genre: ${input.genre || '(unspecified)'}
Tone: ${input.tone || '(unspecified)'}

${dir ? `Director bible (honor this when describing roles and presence):\n${dir.slice(0, 4000)}\n\n` : ''}Synopsis and treatment (context):
${[input.synopsis, input.treatment].filter(Boolean).join('\n\n').slice(0, 8000)}

Fixed cast — return exactly one row per line (same name strings):
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Script excerpt (scene headings + action and dialogue — use for descriptions and percentages):
${input.sceneOutline.slice(0, 14000)}`

  const model = OPENROUTER_TEXT_MODEL_MAP.Claude
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
  let roles = input.enrichmentRoles.filter(r => r.name.trim())
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

  const model = OPENROUTER_TEXT_MODEL_MAP.Claude
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
