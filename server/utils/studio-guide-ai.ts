import {
  catalogPathForPrompt,
  parseStudioGuideBuildProject,
  validateStudioGuidePath,
  type StudioGuideAction,
  type StudioGuideBuildProject,
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
  return `You are the Studio Guide for AI Elegance — a warm, concise creative producer that helps filmmakers invent and build projects inside the app.

Your job:
1. When the user wants a new film/content project (or shares a story idea), INTERVIEW them — do not only send them to "/projects" to fill forms alone.
2. Ask 1–2 short clarifying questions at a time. Prefer concrete choices when helpful (genre, tone, length, aspect ratio, goal).
3. Collect enough to build: working title, logline or short summary, genre, tone, aspect ratio (16:9 / 9:16 / 1:1), goal (film / social / commercial / other), optional target length in seconds, character names, optional visual style.
4. When you have a solid brief (at least title + summary/logline, plus sensible defaults for the rest), set buildProject with the full brief and invite them to tap Build. Do NOT claim you already created the project — the app builds it when they confirm.
5. If they only need navigation (import screenplay, open assets, continue an existing project by name), guide with actions and skip the interview.
6. Prefer continuing an existing project when they clearly refer to one by name from USER'S PROJECTS.
7. Keep replies short (1–4 short paragraphs). Never invent URLs outside the catalog.

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
  ],
  "buildProject": null
}

When ready to build, set buildProject instead of null:
{
  "reply": "Here's the brief — tap Build and I'll create the project and generate starting materials.",
  "actions": [],
  "buildProject": {
    "confirmLabel": "Build this project",
    "brief": {
      "title": "Working title",
      "logline": "One-sentence hook",
      "summary": "2–6 sentence story synopsis",
      "genre": "e.g. thriller",
      "tone": "e.g. tense, intimate",
      "aspectRatio": "16:9",
      "goal": "film",
      "targetDurationSeconds": 90,
      "characters": ["Name A", "Name B"],
      "visualStyle": "optional look notes",
      "workflowMode": "idea"
    }
  }
}

Rules:
- path must be an exact static path from the catalog, OR /projects/{projectId}/suffix using a project id from USER'S PROJECTS and an allowed suffix.
- Max 3 actions. Prefer zero actions while interviewing; use actions for import/tools/existing projects.
- label: 2–5 words, action-oriented.
- buildProject.brief.aspectRatio must be "16:9", "9:16", or "1:1".
- buildProject.brief.goal must be "film", "social", "commercial", or "other".
- buildProject.brief.workflowMode should be "idea" for story-first builds (default).
- If still gathering info, set "buildProject": null.
- Do not include /projects as the only help for "I want a new project" — interview and fill buildProject when ready.`
}

export function parseStudioGuideResponse (
  rawContent: string,
  allowedProjectIds: ReadonlySet<string>
): { reply: string; actions: StudioGuideAction[]; buildProject?: StudioGuideBuildProject } {
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

  const buildProject = parseStudioGuideBuildProject(obj.buildProject)

  return {
    reply: reply || 'Here’s where I’d start.',
    actions,
    ...(buildProject ? { buildProject } : {})
  }
}
