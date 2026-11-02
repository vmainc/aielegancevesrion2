import { describe, expect, it } from 'vitest'
import {
  projectGuidePathContextFromIds,
  validateProjectGuidePath
} from './project-guide'
import {
  buildProjectGuideSystemPrompt,
  parseProjectGuideResponse
} from '../server/utils/project-guide-ai'
import type { ProjectGuideContext } from '../server/utils/project-guide-context'

const PROJECT_A = 'abc123xyzabc123'
const SCENE_A = 'scene1234567890'
const CHAR_A = 'char12345678901'

const PATH_CTX = projectGuidePathContextFromIds({
  projectId: PROJECT_A,
  sceneIds: [SCENE_A],
  characterIds: [CHAR_A]
})

describe('validateProjectGuidePath', () => {
  it('allows project workflow pages for this project only', () => {
    expect(
      validateProjectGuidePath(`/projects/${PROJECT_A}/storyboard`, PATH_CTX)
    ).toBe(`/projects/${PROJECT_A}/storyboard`)
    expect(
      validateProjectGuidePath(`/projects/${PROJECT_A}/director`, PATH_CTX)
    ).toBe(`/projects/${PROJECT_A}/director`)
    expect(
      validateProjectGuidePath(`/projects/zzzzzzzzzzzzzzz/storyboard`, PATH_CTX)
    ).toBeNull()
  })

  it('allows storyboard scene deep link when scene id is known', () => {
    expect(
      validateProjectGuidePath(
        `/projects/${PROJECT_A}/storyboard?scene=${SCENE_A}`,
        PATH_CTX
      )
    ).toBe(`/projects/${PROJECT_A}/storyboard?scene=${SCENE_A}`)
    expect(
      validateProjectGuidePath(
        `/projects/${PROJECT_A}/storyboard?scene=notincontext000`,
        PATH_CTX
      )
    ).toBeNull()
  })

  it('allows bible cast deep link for known characters', () => {
    expect(
      validateProjectGuidePath(
        `/projects/${PROJECT_A}/bible?cast=${CHAR_A}`,
        PATH_CTX
      )
    ).toBe(`/projects/${PROJECT_A}/bible?cast=${CHAR_A}`)
  })

  it('allows video generation when projectId matches', () => {
    expect(
      validateProjectGuidePath(
        `/tools/video-generation?projectId=${PROJECT_A}&sceneId=${SCENE_A}`,
        PATH_CTX
      )
    ).toBe(`/tools/video-generation?projectId=${PROJECT_A}&sceneId=${SCENE_A}`)
    expect(
      validateProjectGuidePath(
        `/tools/video-generation?projectId=otherproject0000&sceneId=${SCENE_A}`,
        PATH_CTX
      )
    ).toBeNull()
  })

  it('allows script wizard without query', () => {
    expect(validateProjectGuidePath('/tools/script-wizard', PATH_CTX)).toBe(
      '/tools/script-wizard'
    )
  })
})

describe('parseProjectGuideResponse actions', () => {
  const baseCtx: ProjectGuideContext = {
    projectBlock: 'Project: Test',
    charactersBlock: `(No characters yet)`,
    scenesBlock: `(No scenes yet)`,
    readinessBlock: 'Story on file: no',
    characterIdsByName: new Map(),
    sceneIds: new Set([SCENE_A]),
    characterIds: new Set([CHAR_A])
  }

  it('parses validated actions and drops invalid paths', () => {
    const raw = JSON.stringify({
      reply: 'Open storyboard next.',
      actions: [
        {
          label: 'Storyboard',
          path: `/projects/${PROJECT_A}/storyboard?scene=${SCENE_A}`,
          rationale: 'Add panels here.'
        },
        {
          label: 'Hack',
          path: '/projects/evilproject000/storyboard'
        }
      ],
      suggestions: []
    })
    const parsed = parseProjectGuideResponse(raw, baseCtx, PROJECT_A)
    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]?.path).toContain('/storyboard')
    expect(parsed.actions[0]?.label).toBe('Storyboard')
  })
})

describe('buildProjectGuideSystemPrompt', () => {
  it('includes destination catalog and readiness', () => {
    const prompt = buildProjectGuideSystemPrompt(
      {
        projectBlock: 'x',
        charactersBlock: 'y',
        scenesBlock: 'z',
        readinessBlock: 'Story on file: yes',
        characterIdsByName: new Map(),
        sceneIds: new Set(),
        characterIds: new Set()
      },
      PROJECT_A
    )
    expect(prompt).toContain('DESTINATION CATALOG')
    expect(prompt).toContain('PRODUCTION READINESS')
    expect(prompt).toContain('actions')
    expect(prompt).toContain(PROJECT_A)
  })
})
