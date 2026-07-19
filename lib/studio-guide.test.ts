import { describe, expect, it } from 'vitest'
import {
  validateStudioGuidePath,
  STUDIO_GUIDE_STATIC_DESTINATIONS
} from '../lib/studio-guide'
import { parseStudioGuideResponse } from '../server/utils/studio-guide-ai'

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
})
