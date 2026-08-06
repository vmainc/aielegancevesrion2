import { describe, expect, it } from 'vitest'
import {
  validateStudioGuidePath,
  STUDIO_GUIDE_STATIC_DESTINATIONS,
  createEmptyStudioGuideChat,
  deleteStudioGuideChat,
  emptyStudioGuideChatStore,
  formatStudioGuideBriefAsConceptNotes,
  parseStudioGuideProjectBrief,
  studioGuideBriefIsReady,
  titleFromStudioGuideMessages,
  upsertStudioGuideChat
} from '../lib/studio-guide'
import {
  buildStudioGuideSystemPrompt,
  parseStudioGuideResponse
} from '../server/utils/studio-guide-ai'

const PROJECT_A = 'abcdefghijklmno'
const PROJECT_B = '1234567890abcde'
const ALLOWED = new Set([PROJECT_A, PROJECT_B])

describe('validateStudioGuidePath', () => {
  it('allows catalog static paths', () => {
    for (const d of STUDIO_GUIDE_STATIC_DESTINATIONS) {
      expect(validateStudioGuidePath(d.path, ALLOWED)).toBe(d.path)
    }
  })

  it('allows project paths for accessible ids and known suffixes', () => {
    expect(validateStudioGuidePath(`/projects/${PROJECT_A}/guide`, ALLOWED)).toBe(
      `/projects/${PROJECT_A}/guide`
    )
    expect(validateStudioGuidePath(`/projects/${PROJECT_B}/storyboard`, ALLOWED)).toBe(
      `/projects/${PROJECT_B}/storyboard`
    )
  })

  it('rejects inaccessible project ids', () => {
    expect(validateStudioGuidePath('/projects/zzzzzzzzzzzzzzz/guide', ALLOWED)).toBeNull()
  })

  it('rejects unknown suffixes and external urls', () => {
    expect(validateStudioGuidePath(`/projects/${PROJECT_A}/timeline`, ALLOWED)).toBeNull()
    expect(validateStudioGuidePath('https://evil.example/x', ALLOWED)).toBeNull()
    expect(validateStudioGuidePath('/projects/../admin', ALLOWED)).toBeNull()
    expect(validateStudioGuidePath('/secret', ALLOWED)).toBeNull()
  })

  it('strips query and hash before validating', () => {
    expect(validateStudioGuidePath('/projects?x=1', ALLOWED)).toBe('/projects')
    expect(
      validateStudioGuidePath(`/projects/${PROJECT_A}/guide#top`, ALLOWED)
    ).toBe(`/projects/${PROJECT_A}/guide`)
  })
})

describe('parseStudioGuideResponse', () => {
  it('parses reply and keep only allowlisted actions', () => {
    const raw = JSON.stringify({
      reply: 'Let’s open your project.',
      actions: [
        {
          label: 'Continue Skele',
          path: `/projects/${PROJECT_A}/guide`,
          rationale: 'Pick up where you left off.'
        },
        {
          label: 'Evil',
          path: 'https://evil.example',
          rationale: 'nope'
        },
        {
          label: 'Projects',
          path: '/projects',
          rationale: 'Browse all work.'
        },
        {
          label: 'Dup',
          path: '/projects',
          rationale: 'duplicate'
        }
      ]
    })
    const parsed = parseStudioGuideResponse(raw, ALLOWED)
    expect(parsed.reply).toBe('Let’s open your project.')
    expect(parsed.actions).toHaveLength(2)
    expect(parsed.actions[0]?.path).toBe(`/projects/${PROJECT_A}/guide`)
    expect(parsed.actions[1]?.path).toBe('/projects')
  })

  it('falls back when model returns non-JSON', () => {
    const parsed = parseStudioGuideResponse('Just plain text advice.', ALLOWED)
    expect(parsed.reply).toBe('Just plain text advice.')
    expect(parsed.actions).toEqual([])
  })

  it('caps actions at 3', () => {
    const actions = [
      { label: 'A', path: '/projects' },
      { label: 'B', path: '/assets' },
      { label: 'C', path: '/tools' },
      { label: 'D', path: '/account' }
    ]
    const parsed = parseStudioGuideResponse(JSON.stringify({ reply: 'ok', actions }), ALLOWED)
    expect(parsed.actions).toHaveLength(3)
  })

  it('rejects project actions for ids not in allowlist', () => {
    const raw = JSON.stringify({
      reply: 'Hmm',
      actions: [{ label: 'Hack', path: '/projects/notarealprojectx/guide' }]
    })
    const parsed = parseStudioGuideResponse(raw, ALLOWED)
    expect(parsed.actions).toEqual([])
  })

  it('parses buildProject brief when ready', () => {
    const raw = JSON.stringify({
      reply: 'Ready to build.',
      actions: [],
      buildProject: {
        confirmLabel: 'Build this project',
        brief: {
          title: 'Night Ferry',
          logline: 'A courier races a storm across the bay.',
          summary: 'A courier races a storm across the bay with a package she must not open.',
          genre: 'thriller',
          tone: 'tense',
          aspectRatio: '16:9',
          goal: 'film',
          targetDurationSeconds: 120,
          characters: ['Mara', 'Captain Voss'],
          visualStyle: 'wet neon streets',
          workflowMode: 'idea'
        }
      }
    })
    const parsed = parseStudioGuideResponse(raw, ALLOWED)
    expect(parsed.buildProject?.brief.title).toBe('Night Ferry')
    expect(parsed.buildProject?.brief.characters).toEqual(['Mara', 'Captain Voss'])
    expect(parsed.buildProject?.confirmLabel).toBe('Build this project')
  })

  it('omits invalid buildProject payloads', () => {
    const parsed = parseStudioGuideResponse(
      JSON.stringify({
        reply: 'Still gathering.',
        buildProject: { confirmLabel: 'Build', brief: { title: '' } }
      }),
      ALLOWED
    )
    expect(parsed.buildProject).toBeUndefined()
  })
})

describe('studio guide project brief', () => {
  it('requires title, summary/logline, and duration for readiness', () => {
    expect(parseStudioGuideProjectBrief({ title: 'X' })).toBeNull()
    const withoutDuration = parseStudioGuideProjectBrief({
      title: 'X',
      logline: 'A short hook.'
    })
    expect(withoutDuration).not.toBeNull()
    expect(studioGuideBriefIsReady(withoutDuration!)).toBe(false)

    const withDuration = parseStudioGuideProjectBrief({
      title: 'X',
      logline: 'A short hook.',
      targetDurationSeconds: 10
    })
    expect(studioGuideBriefIsReady(withDuration!)).toBe(true)
    expect(withDuration?.targetDurationSeconds).toBe(10)
  })

  it('keeps 10s instead of bumping to 15', () => {
    const brief = parseStudioGuideProjectBrief({
      title: 'Leap',
      summary: 'Dog leaps over cat.',
      targetDurationSeconds: 10
    })
    expect(brief?.targetDurationSeconds).toBe(10)
  })

  it('normalizes aspect, goal, and characters', () => {
    const brief = parseStudioGuideProjectBrief({
      title: 'Test',
      summary: 'Story summary here.',
      targetDurationSeconds: 30,
      aspectRatio: 'weird',
      goal: 'nope',
      characters: [' Ada ', '', 12, 'Ben']
    })
    expect(brief?.aspectRatio).toBe('16:9')
    expect(brief?.goal).toBe('film')
    expect(brief?.characters).toEqual(['Ada', 'Ben'])
  })

  it('formats concept notes with title and cast marker', () => {
    const notes = formatStudioGuideBriefAsConceptNotes({
      title: 'Night Ferry',
      logline: 'A courier races a storm.',
      summary: 'Longer synopsis.',
      genre: 'thriller',
      tone: 'tense',
      aspectRatio: '16:9',
      goal: 'film',
      characters: ['Mara'],
      workflowMode: 'idea'
    })
    expect(notes).toContain('**Title:** Night Ferry')
    expect(notes).toContain('aielegance:characters=')
    expect(notes).toContain('Longer synopsis.')
  })
})

describe('buildStudioGuideSystemPrompt', () => {
  it('instructs interview-and-build with duration and single-clip awareness', () => {
    const prompt = buildStudioGuideSystemPrompt([{ id: PROJECT_A, name: 'Skele' }])
    expect(prompt).toContain('INTERVIEW')
    expect(prompt).toContain('buildProject')
    expect(prompt).toContain('TARGET LENGTH')
    expect(prompt).toContain('ONE storyboard board')
    expect(prompt).toContain('Do NOT claim you already created')
  })
})

describe('studio guide chat sessions', () => {
  it('titles a chat from the first user message', () => {
    expect(titleFromStudioGuideMessages([])).toBe('New chat')
    expect(
      titleFromStudioGuideMessages([
        {
          id: '1',
          role: 'user',
          content: 'I want to start a new film project about space.',
          createdAt: new Date().toISOString()
        }
      ])
    ).toBe('I want to start a new film project about space.')
  })

  it('upserts and deletes chats while keeping an active id', () => {
    let store = emptyStudioGuideChatStore()
    const a = createEmptyStudioGuideChat()
    a.title = 'Chat A'
    store = upsertStudioGuideChat(store, a)
    expect(store.activeChatId).toBe(a.id)
    expect(store.chats).toHaveLength(1)

    const b = createEmptyStudioGuideChat()
    b.title = 'Chat B'
    store = upsertStudioGuideChat(store, b)
    expect(store.activeChatId).toBe(b.id)
    expect(store.chats).toHaveLength(2)

    store = deleteStudioGuideChat(store, b.id)
    expect(store.activeChatId).toBe(a.id)
    expect(store.chats.map(c => c.id)).toEqual([a.id])
  })
})
