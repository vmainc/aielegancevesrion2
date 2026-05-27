import {
  buildFallbackScreenplayDraft,
  normalizeScreenplayCharacterName,
  sanitizeCharacterNameList,
  SCREENPLAY_AI_FORMAT_RULES
} from '~/lib/screenplay-format'
import {
  resolveProjectDurationBudget,
  screenplayDurationGuidance,
  type ProjectDurationBudget
} from '~/lib/project-duration-budget'
import { formatDirectorForAiPrompt } from '~/server/utils/creative-project-map'
import type { ProjectDirector, ProjectGoal } from '~/types/creative-project'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

const DEFAULT_MODEL =
  process.env.NUXT_OPENROUTER_STORY_MODEL ||
  process.env.OPENROUTER_STORY_MODEL ||
  'openai/gpt-4o-mini'

function guessCharactersFromSummary (summary: string, title: string): string[] {
  const text = `${title} ${summary}`.toLowerCase()
  const guesses: string[] = []
  if (/\bdog\b|\bpuppy\b|\bcanine\b/.test(text)) guesses.push('BUDDY')
  if (/\bcat\b|\bkitten\b|\bfeline\b/.test(text)) guesses.push('WHISKERS')
  if (/\bmom\b|\bmother\b/.test(text)) guesses.push('MOM')
  if (/\bdad\b|\bfather\b/.test(text)) guesses.push('DAD')
  if (/\bchild\b|\bkid\b|\bboy\b|\bgirl\b/.test(text)) guesses.push('KID')
  if (guesses.length === 0) guesses.push('HERO', 'ALLY')
  return [...new Set(guesses.map(normalizeScreenplayCharacterName).filter(Boolean))].slice(0, 6)
}

export function resolveCastForStoryIdea (input: {
  characters?: unknown
  summary: string
  title: string
}): Array<{ name: string; description?: string }> {
  const fromBody = sanitizeCharacterNameList(input.characters)
  const names =
    fromBody.length > 0 ? fromBody : guessCharactersFromSummary(input.summary, input.title)
  return names.map(name => ({ name, description: 'Speaking role from story idea.' }))
}

export async function generateScreenplayFromStoryIdea (input: {
  title: string
  logline?: string
  summary: string
  genre?: string
  tone?: string
  characters?: unknown
  goal?: string
  targetDurationSeconds?: number
  targetLength?: import('~/types/creative-project').ProjectTargetLength
  durationBudget?: ProjectDurationBudget | null
  visualReference?: string
  director?: ProjectDirector | null
}): Promise<string> {
  const cast = resolveCastForStoryIdea({
    characters: input.characters,
    summary: input.summary,
    title: input.title
  })
  const castNames = cast.map(c => c.name).join(', ')

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return buildFallbackScreenplayDraft({
      title: input.title,
      logline: input.logline,
      summary: input.summary,
      characters: cast
    })
  }

  const goal = (input.goal || 'film') as ProjectGoal
  const budget =
    input.durationBudget ??
    resolveProjectDurationBudget({
      targetDurationSeconds: input.targetDurationSeconds,
      targetLength: input.targetLength,
      goal
    })
  const durationBlock = budget
    ? `\n\n${screenplayDurationGuidance(budget, goal)}`
    : `\n\nTarget: ${goal === 'social' ? 'short social video (under 2 minutes on screen)' : goal === 'commercial' ? '30–60 second spot' : 'short film / proof-of-concept (about 3–8 pages)'}.`
  const maxTokens =
    budget && budget.totalSeconds <= 25 ? 1200 : budget && budget.totalSeconds <= 60 ? 2200 : 5500

  const system = `You are an experienced screenwriter drafting a short screenplay for development and automated import.

${SCREENPLAY_AI_FORMAT_RULES}
${durationBlock}`

  const visualBlock = (input.visualReference || '').trim()
    ? `Visual reference (honor look, palette, wardrobe, mood):\n${input.visualReference!.trim().slice(0, 3000)}\n`
    : ''
  const directorBlock = input.director
    ? `Director bible (honor in action lines and scene tone):\n${formatDirectorForAiPrompt(input.director).slice(0, 3500)}\n`
    : ''

  const userMsg = [
    `Title: ${input.title}`,
    input.logline ? `Logline: ${input.logline}` : '',
    input.genre ? `Genre: ${input.genre}` : '',
    input.tone ? `Tone: ${input.tone}` : '',
    `Required speaking characters (use these exact ALL CAPS names in CAST and dialogue): ${castNames}`,
    '',
    visualBlock,
    directorBlock,
    'Story summary to adapt:',
    input.summary.trim(),
    '',
    budget && budget.totalSeconds <= 60
      ? `Write the screenplay now. Hard cap: ~${budget.totalSeconds}s on screen (~${budget.maxPanelsTotal} beats). Begin with title, CAST, then the minimum scenes needed — no extra acts.`
      : 'Write the screenplay now. Begin with the title, then CAST, then slug lines and scenes.'
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const body = buildOpenRouterChatCompletionBody({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.65,
      max_tokens: maxTokens
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    }
    if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
    if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 120_000)
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    }).finally(() => clearTimeout(t))

    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}`)
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content || content.length < 200) {
      throw new Error('Screenplay too short')
    }
    return content.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim().slice(0, 300_000)
  } catch {
    return buildFallbackScreenplayDraft({
      title: input.title,
      logline: input.logline,
      summary: input.summary,
      characters: cast
    })
  }
}
