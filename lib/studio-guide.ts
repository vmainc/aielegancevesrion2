/** Studio-wide Guide — routing assistant (client + server). */

export type StudioGuideAction = {
  id: string
  label: string
  path: string
  rationale?: string
}

/** Structured project brief the Guide gathers before creating a film project. */
export type StudioGuideProjectBrief = {
  title: string
  logline: string
  summary: string
  genre: string
  tone: string
  aspectRatio: '16:9' | '9:16' | '1:1'
  goal: 'film' | 'social' | 'commercial' | 'other'
  targetDurationSeconds?: number
  characters: string[]
  visualStyle?: string
  workflowMode: 'idea' | 'generate'
}

export type StudioGuideBuildProject = {
  confirmLabel: string
  brief: StudioGuideProjectBrief
}

export type StudioGuideChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: StudioGuideAction[]
  /** When set, UI shows a Build card so the Guide can create the project. */
  buildProject?: StudioGuideBuildProject
  createdAt: string
}

export type StudioGuideDestination = {
  id: string
  label: string
  description: string
  /** Absolute app path, or `/projects/{projectId}/…` template for project-scoped destinations. */
  path: string
  kind: 'static' | 'project'
}

export type StudioGuideProjectSummary = {
  id: string
  name: string
}

const PB_ID = /^[a-z0-9]{15}$/

/** Allowed static destinations the model may recommend. */
export const STUDIO_GUIDE_STATIC_DESTINATIONS: StudioGuideDestination[] = [
  {
    id: 'projects',
    label: 'Projects',
    description: 'Browse existing projects or start a new one.',
    path: '/projects',
    kind: 'static'
  },
  {
    id: 'import-script',
    label: 'Import a screenplay',
    description: 'Upload a script and turn it into scenes, cast, and storyboard.',
    path: '/tools/script-wizard',
    kind: 'static'
  },
  {
    id: 'video-generation',
    label: 'Generate video',
    description: 'Create clips with AI video models.',
    path: '/tools/video-generation',
    kind: 'static'
  },
  {
    id: 'fix-shot',
    label: 'Fix Shot',
    description: 'Repair an existing clip without regenerating the whole shot.',
    path: '/tools/fix-shot',
    kind: 'static'
  },
  {
    id: 'music-generation',
    label: 'Generate music',
    description: 'Create soundtrack and music cues.',
    path: '/tools/music-generation',
    kind: 'static'
  },
  {
    id: 'character-creator',
    label: 'Create a character',
    description: 'Design a character look and save it to assets.',
    path: '/character-creator',
    kind: 'static'
  },
  {
    id: 'storyboard-builder',
    label: 'Storyboard builder',
    description: 'Standalone storyboard tool outside a project.',
    path: '/tools/storyboard-builder',
    kind: 'static'
  },
  {
    id: 'script-wizard',
    label: 'Script Wizard',
    description: 'Develop or refine a screenplay with AI.',
    path: '/tools/script-wizard',
    kind: 'static'
  },
  {
    id: 'assets',
    label: 'Assets',
    description: 'Browse videos, scripts, characters, storyboards, and music.',
    path: '/assets',
    kind: 'static'
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'All standalone creative tools.',
    path: '/tools',
    kind: 'static'
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Account settings and profile.',
    path: '/account',
    kind: 'static'
  }
]

/** Allowed project-scoped destination suffixes (after `/projects/{id}`). */
export const STUDIO_GUIDE_PROJECT_SUFFIXES = [
  '/guide',
  '/overview',
  '/home',
  '/characters',
  '/director',
  '/scenes',
  '/storyboard',
  '/video',
  '/bible',
  '/review'
] as const

export type StudioGuideProjectSuffix = (typeof STUDIO_GUIDE_PROJECT_SUFFIXES)[number]

export const STUDIO_GUIDE_PROJECT_DESTINATIONS: Array<{
  id: string
  label: string
  description: string
  suffix: StudioGuideProjectSuffix
}> = [
  {
    id: 'project-guide',
    label: 'Project Guide',
    description: 'Chat about this project’s story, cast, and next steps.',
    suffix: '/guide'
  },
  {
    id: 'project-story',
    label: 'Story',
    description: 'Edit synopsis, treatment, and concept.',
    suffix: '/overview'
  },
  {
    id: 'project-steps',
    label: 'Dashboard',
    description: 'Project dashboard — jump to any workflow step.',
    suffix: '/home'
  },
  {
    id: 'project-characters',
    label: 'Characters',
    description: 'Cast bible and character looks.',
    suffix: '/characters'
  },
  {
    id: 'project-director',
    label: 'Director',
    description: 'Visual tone and director bible.',
    suffix: '/director'
  },
  {
    id: 'project-scenes',
    label: 'Scenes',
    description: 'Scene list and breakdown.',
    suffix: '/scenes'
  },
  {
    id: 'project-storyboard',
    label: 'Storyboard',
    description: 'Panels, start/end frames, and Generate video when both frames are ready.',
    suffix: '/storyboard'
  }
]

export const STUDIO_GUIDE_STORAGE_KEY = 'aielegance-studio-guide'
/** Multi-chat store (ChatGPT-style). Migrates from legacy single-thread key. */
export const STUDIO_GUIDE_CHATS_STORAGE_KEY = 'aielegance-studio-guide-chats'

export type StudioGuideChat = {
  id: string
  title: string
  messages: StudioGuideChatMessage[]
  createdAt: string
  updatedAt: string
}

export type StudioGuideChatStore = {
  version: 1
  activeChatId: string | null
  chats: StudioGuideChat[]
}

const STATIC_PATHS = new Set(STUDIO_GUIDE_STATIC_DESTINATIONS.map(d => d.path))
const PROJECT_SUFFIX_SET = new Set<string>(STUDIO_GUIDE_PROJECT_SUFFIXES)

export function isCloudProjectId (id: string): boolean {
  return PB_ID.test(id)
}

export function projectGuidePath (projectId: string): string {
  return `/projects/${projectId}/guide`
}

export function catalogPathForPrompt (): string {
  const staticLines = STUDIO_GUIDE_STATIC_DESTINATIONS.map(
    d => `- ${d.path} — ${d.label}: ${d.description}`
  ).join('\n')
  const projectLines = STUDIO_GUIDE_PROJECT_DESTINATIONS.map(
    d => `- /projects/{projectId}${d.suffix} — ${d.label}: ${d.description}`
  ).join('\n')
  return `Static destinations:\n${staticLines}\n\nProject destinations (replace {projectId} with an id from the user's projects):\n${projectLines}`
}

/**
 * Validate a path the model proposed. Returns the path if allowed, else null.
 * Project paths require the id to be in `allowedProjectIds`.
 */
export function validateStudioGuidePath (
  rawPath: string,
  allowedProjectIds: ReadonlySet<string> | readonly string[]
): string | null {
  const path = String(rawPath || '').trim()
  if (!path.startsWith('/') || path.includes('://') || path.includes('..') || path.includes('\\')) {
    return null
  }
  // Strip query/hash for allowlist check; keep path only.
  const bare = path.split('?')[0]?.split('#')[0] || ''
  if (!bare) return null

  if (STATIC_PATHS.has(bare)) return bare

  const m = bare.match(/^\/projects\/([a-z0-9]{15})(\/[\w-]+)?$/)
  if (!m) return null
  const projectId = m[1]!
  const suffix = m[2] || '/guide'
  const allowed =
    allowedProjectIds instanceof Set
      ? allowedProjectIds
      : new Set(allowedProjectIds)
  if (!allowed.has(projectId)) return null
  if (!PROJECT_SUFFIX_SET.has(suffix)) return null
  return `/projects/${projectId}${suffix}`
}

export function newStudioGuideMessageId (): string {
  return `sg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function newStudioGuideChatId (): string {
  return `sc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function parseActions (raw: unknown): StudioGuideAction[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: StudioGuideAction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (
      typeof o.id !== 'string' ||
      typeof o.label !== 'string' ||
      typeof o.path !== 'string'
    ) {
      continue
    }
    out.push({
      id: o.id,
      label: o.label,
      path: o.path,
      rationale: typeof o.rationale === 'string' ? o.rationale : undefined
    })
  }
  return out.length ? out : undefined
}

const ASPECTS = new Set(['16:9', '9:16', '1:1'])
const GOALS = new Set(['film', 'social', 'commercial', 'other'])

export function parseStudioGuideProjectBrief (raw: unknown): StudioGuideProjectBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : ''
  const logline = typeof o.logline === 'string' ? o.logline.trim().slice(0, 500) : ''
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 8000) : ''
  if (!title || !(summary || logline)) return null

  const aspectRaw = typeof o.aspectRatio === 'string' ? o.aspectRatio.trim() : '16:9'
  const goalRaw = typeof o.goal === 'string' ? o.goal.trim() : 'film'
  const workflowRaw = typeof o.workflowMode === 'string' ? o.workflowMode.trim() : 'idea'
  const characters = Array.isArray(o.characters)
    ? o.characters
        .map(c => (typeof c === 'string' ? c.trim().slice(0, 80) : ''))
        .filter(Boolean)
        .slice(0, 12)
    : []

  let targetDurationSeconds: number | undefined
  if (typeof o.targetDurationSeconds === 'number' && Number.isFinite(o.targetDurationSeconds)) {
    targetDurationSeconds = Math.floor(o.targetDurationSeconds)
  } else if (typeof o.targetDurationSeconds === 'string' && o.targetDurationSeconds.trim()) {
    const n = Math.floor(Number(o.targetDurationSeconds))
    if (Number.isFinite(n)) targetDurationSeconds = n
  }
  if (targetDurationSeconds != null) {
    if (targetDurationSeconds < 5) targetDurationSeconds = 5
    if (targetDurationSeconds > 3600) targetDurationSeconds = 3600
  }

  return {
    title,
    logline: logline || summary.split('\n')[0]!.slice(0, 500),
    summary: summary || logline,
    genre: typeof o.genre === 'string' ? o.genre.trim().slice(0, 80) : '',
    tone: typeof o.tone === 'string' ? o.tone.trim().slice(0, 120) : '',
    aspectRatio: (ASPECTS.has(aspectRaw) ? aspectRaw : '16:9') as StudioGuideProjectBrief['aspectRatio'],
    goal: (GOALS.has(goalRaw) ? goalRaw : 'film') as StudioGuideProjectBrief['goal'],
    targetDurationSeconds,
    characters,
    visualStyle:
      typeof o.visualStyle === 'string' ? o.visualStyle.trim().slice(0, 300) : undefined,
    workflowMode: workflowRaw === 'generate' ? 'generate' : 'idea'
  }
}

export function parseStudioGuideBuildProject (raw: unknown): StudioGuideBuildProject | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const brief = parseStudioGuideProjectBrief(o.brief)
  if (!brief) return undefined
  const confirmLabel =
    typeof o.confirmLabel === 'string' && o.confirmLabel.trim()
      ? o.confirmLabel.trim().slice(0, 60)
      : 'Build this project'
  return { confirmLabel, brief }
}

export function studioGuideBriefIsReady (brief: StudioGuideProjectBrief): boolean {
  return Boolean(
    brief.title.trim() &&
      (brief.summary.trim() || brief.logline.trim()) &&
      typeof brief.targetDurationSeconds === 'number' &&
      brief.targetDurationSeconds >= 5
  )
}

/** Seed concept_notes so bootstrap / story UI can read title, logline, and cast. */
export function formatStudioGuideBriefAsConceptNotes (brief: StudioGuideProjectBrief): string {
  const castMarker =
    brief.characters.length > 0
      ? `\n<!-- aielegance:characters=${JSON.stringify(brief.characters)} -->\n`
      : ''
  const style =
    brief.visualStyle?.trim()
      ? `\n**Visual style:** ${brief.visualStyle.trim().slice(0, 300)}\n`
      : ''
  return `<!-- aielegance:source=studio-guide -->
**Title:** ${brief.title}

**Logline:** ${brief.logline || brief.summary.split('\n')[0] || ''}
${castMarker}${style}
---

${brief.summary || brief.logline}
`
}

function parseMessage (m: unknown): StudioGuideChatMessage | null {
  if (!m || typeof m !== 'object') return null
  const msg = m as StudioGuideChatMessage
  if (
    typeof msg.id !== 'string' ||
    (msg.role !== 'user' && msg.role !== 'assistant') ||
    typeof msg.content !== 'string'
  ) {
    return null
  }
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : new Date().toISOString(),
    actions: parseActions(msg.actions),
    buildProject: parseStudioGuideBuildProject(msg.buildProject)
  }
}

/** Title from the first user message (ChatGPT-style). */
export function titleFromStudioGuideMessages (messages: StudioGuideChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user' && m.content.trim())
  if (!firstUser) return 'New chat'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 48 ? `${t.slice(0, 48).trim()}…` : t
}

export function createEmptyStudioGuideChat (): StudioGuideChat {
  const now = new Date().toISOString()
  return {
    id: newStudioGuideChatId(),
    title: 'New chat',
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

export function emptyStudioGuideChatStore (): StudioGuideChatStore {
  return { version: 1, activeChatId: null, chats: [] }
}

function parseChat (raw: unknown): StudioGuideChat | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  const messages = Array.isArray(o.messages)
    ? o.messages.map(parseMessage).filter((m): m is StudioGuideChatMessage => !!m)
    : []
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString()
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : createdAt
  const title =
    typeof o.title === 'string' && o.title.trim()
      ? o.title.trim().slice(0, 80)
      : titleFromStudioGuideMessages(messages)
  return { id: o.id, title, messages, createdAt, updatedAt }
}

/** Legacy single-thread message array. */
export function loadStudioGuideMessages (): StudioGuideChatMessage[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STUDIO_GUIDE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseMessage).filter((m): m is StudioGuideChatMessage => !!m)
  } catch {
    return []
  }
}

export function saveStudioGuideMessages (messages: StudioGuideChatMessage[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STUDIO_GUIDE_STORAGE_KEY, JSON.stringify(messages.slice(-80)))
  } catch {
    /* quota / private mode */
  }
}

export function loadStudioGuideChatStore (): StudioGuideChatStore {
  if (typeof localStorage === 'undefined') return emptyStudioGuideChatStore()
  try {
    const raw = localStorage.getItem(STUDIO_GUIDE_CHATS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        const o = parsed as Record<string, unknown>
        const chats = Array.isArray(o.chats)
          ? o.chats.map(parseChat).filter((c): c is StudioGuideChat => !!c)
          : []
        let activeChatId =
          typeof o.activeChatId === 'string' && chats.some(c => c.id === o.activeChatId)
            ? o.activeChatId
            : chats[0]?.id || null
        return { version: 1, activeChatId, chats }
      }
    }
  } catch {
    /* fall through to migrate */
  }

  // Migrate legacy single thread into one chat.
  const legacy = loadStudioGuideMessages()
  if (legacy.length) {
    const now = new Date().toISOString()
    const chat: StudioGuideChat = {
      id: newStudioGuideChatId(),
      title: titleFromStudioGuideMessages(legacy),
      messages: legacy.slice(-80),
      createdAt: legacy[0]?.createdAt || now,
      updatedAt: legacy[legacy.length - 1]?.createdAt || now
    }
    const store: StudioGuideChatStore = {
      version: 1,
      activeChatId: chat.id,
      chats: [chat]
    }
    saveStudioGuideChatStore(store)
    return store
  }

  return emptyStudioGuideChatStore()
}

export function saveStudioGuideChatStore (store: StudioGuideChatStore): void {
  if (typeof localStorage === 'undefined') return
  try {
    const chats = store.chats
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40)
      .map(c => ({
        ...c,
        messages: c.messages.slice(-80)
      }))
    const activeChatId =
      store.activeChatId && chats.some(c => c.id === store.activeChatId)
        ? store.activeChatId
        : chats[0]?.id || null
    localStorage.setItem(
      STUDIO_GUIDE_CHATS_STORAGE_KEY,
      JSON.stringify({ version: 1, activeChatId, chats } satisfies StudioGuideChatStore)
    )
    // Keep legacy key in sync with active chat for older code paths.
    const active = chats.find(c => c.id === activeChatId)
    saveStudioGuideMessages(active?.messages || [])
  } catch {
    /* quota / private mode */
  }
}

export function upsertStudioGuideChat (
  store: StudioGuideChatStore,
  chat: StudioGuideChat
): StudioGuideChatStore {
  const others = store.chats.filter(c => c.id !== chat.id)
  return {
    version: 1,
    activeChatId: chat.id,
    chats: [chat, ...others]
  }
}

export function deleteStudioGuideChat (
  store: StudioGuideChatStore,
  chatId: string
): StudioGuideChatStore {
  const chats = store.chats.filter(c => c.id !== chatId)
  const activeChatId =
    store.activeChatId === chatId ? chats[0]?.id || null : store.activeChatId
  return { version: 1, activeChatId, chats }
}

export function formatStudioGuideChatTime (iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday'
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Starter chips shown on the empty Studio Guide state. */
export const STUDIO_GUIDE_STARTERS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Help me invent a project',
    prompt:
      'I want to create a new film project. First ask how many seconds long it should be (clips are 5s or 10s), then a few story questions, then build it for me.'
  },
  {
    label: 'I already have an idea',
    prompt:
      'I have a story idea. Ask how long the finished video should be in seconds, interview me about it, then create the project sized to that runtime.'
  },
  {
    label: 'Make a 10-second clip',
    prompt:
      'I want a single ~10 second video — one board, one Generate video. Ask me the story details and build it.'
  },
  {
    label: 'Import a screenplay',
    prompt: 'I have a screenplay to import.'
  },
  {
    label: 'Generate video',
    prompt: 'I want to generate a video clip.'
  },
  {
    label: 'Continue a project',
    prompt: 'Help me continue one of my existing projects.'
  },
  {
    label: 'Browse my assets',
    prompt: 'Where can I find my saved videos and assets?'
  }
]
