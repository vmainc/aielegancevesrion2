import {
  catalogPathForPrompt,
  validateStudioGuidePath,
  type StudioGuideAction,
  type StudioGuideProjectSummary
} from '~/lib/studio-guide'

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

function formatProjectsBlock (projects: StudioGuideProjectSummary[]): string {
  if (!projects.length) return '(no projects yet)'
  return projects
    .slice(0, 24)
    .map(p => `- ${p.id} — ${p.name || 'Untitled'}`)
    .join('\n')
}

export function buildStudioGuideSystemPrompt (projects: StudioGuideProjectSummary[]): string {
  return `You are the Studio Guide for AI Elegance — a warm, concise product assistant that helps filmmakers decide what to do next in the app.

Your job:
1. Greet intent clearly. When the user is exploring, keep the spirit of "What do you want to do today?"
2. Ask one clarifying question only when needed; otherwise recommend the best next step.
3. Guide each action with short, practical advice (1–4 short paragraphs).
4. Propose 1–3 navigation actions the user can tap. Never invent URLs outside the catalog below.
5. Prefer continuing an existing project when the user clearly refers to one by name.
6. Do not claim you created projects, generated video, or changed settings — you only guide and route.

=== DESTINATION CATALOG ===
${catalogPathForPrompt()}

=== USER'S PROJECTS ===
${formatProjectsBlock(projects)}

OUTPUT FORMAT — respond with ONLY valid JSON (no markdown fences):
{
  "reply": "your conversational response",
  "actions": [
    {
      "label": "short button label",
      "path": "/exact/allowed/path",
      "rationale": "one sentence why this helps"
    }
  ]
}

Rules for actions:
- path must be an exact static path from the catalog, OR /projects/{projectId}/suffix using a project id from USER'S PROJECTS and an allowed suffix.
- Max 3 actions. Prefer the single best next step when the intent is clear.
- label: 2–5 words, action-oriented (e.g. "Open Projects", "Import screenplay", "Continue Skele").
- Do not include actions with empty labels or paths.`
}

export function parseStudioGuideResponse (
  rawContent: string,
  allowedProjectIds: ReadonlySet<string>
): { reply: string; actions: StudioGuideAction[] } {
  const obj = extractJsonObject(rawContent)
  if (!obj) {
    const fallback = rawContent.trim()
    return {
      reply: fallback || 'I could not parse a response. Try again.',
      actions: []
    }
  }

  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : ''
  const rawActions = Array.isArray(obj.actions) ? obj.actions : []
  const actions: StudioGuideAction[] = []
  let idx = 0

  for (const item of rawActions) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 80) : ''
    const pathRaw = typeof o.path === 'string' ? o.path.trim() : ''
    if (!label || !pathRaw) continue

    const path = validateStudioGuidePath(pathRaw, allowedProjectIds)
    if (!path) continue

    // Dedupe identical paths
    if (actions.some(a => a.path === path)) continue

    actions.push({
      id: `a${Date.now().toString(36)}${idx++}`,
      label,
      path,
      rationale:
        typeof o.rationale === 'string' ? o.rationale.trim().slice(0, 300) : undefined
    })
    if (actions.length >= 3) break
  }

  return {
    reply: reply || 'Here’s where I’d start.',
    actions
  }
}
