import {
  formatDirectorForAiPrompt,
  pbRecordToCreativeProject,
  parseDirectorField
} from '~/server/utils/creative-project-map'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { assertUserHasProjectAccess } from '~/server/utils/project-access'
import type PocketBase from 'pocketbase'

export type ProjectGuideContext = {
  projectBlock: string
  charactersBlock: string
  scenesBlock: string
  readinessBlock: string
  characterIdsByName: Map<string, string>
  sceneIds: Set<string>
  characterIds: Set<string>
}

function normalizeName (v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function loadProjectGuideContext (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<ProjectGuideContext> {
  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  await assertUserHasProjectAccess(pb, userId, projectId)

  const project = pbRecordToCreativeProject(projectRow as Parameters<typeof pbRecordToCreativeProject>[0])
  const director = parseDirectorField((projectRow as { director?: unknown }).director) || project.director

  const projectLines: string[] = [
    `Project: ${project.name}`,
    project.goal ? `Goal: ${project.goal}` : '',
    project.aspectRatio ? `Aspect ratio: ${project.aspectRatio}` : '',
    project.genre ? `Genre: ${project.genre}` : '',
    project.tone ? `Tone: ${project.tone}` : '',
    project.synopsis ? `Synopsis:\n${project.synopsis.slice(0, 4000)}` : '',
    project.treatment ? `Treatment (excerpt):\n${project.treatment.slice(0, 3000)}` : '',
    project.conceptNotes ? `Concept notes (excerpt):\n${project.conceptNotes.slice(0, 2000)}` : '',
    formatDirectorForAiPrompt(director) ? `Director bible:\n${formatDirectorForAiPrompt(director)}` : '',
    project.continuityMemory ? `Continuity memory:\n${project.continuityMemory.slice(0, 4000)}` : ''
  ].filter(Boolean)

  let characterRows: Array<Record<string, unknown>> = []
  try {
    characterRows = (await pb.collection('creative_characters').getFullList({
      filter: `project = "${projectId}"`,
      sort: 'name'
    })) as Array<Record<string, unknown>>
  } catch {
    characterRows = []
  }

  const characterIdsByName = new Map<string, string>()
  const charLines: string[] = []
  for (const row of characterRows) {
    if (projectIdOnCharacterRow(row) !== projectId) continue
    const c = pbRecordToCreativeCharacter(row)
    characterIdsByName.set(normalizeName(c.name), c.id)
    const bits = [
      `• ${c.name} (id: ${c.id})`,
      c.roleDescription ? `  Role: ${c.roleDescription.slice(0, 400)}` : '',
      c.appearanceDescription ? `  Appearance: ${c.appearanceDescription.slice(0, 400)}` : '',
      c.personality ? `  Personality: ${c.personality.slice(0, 300)}` : '',
      c.voiceDescription ? `  Voice: ${c.voiceDescription.slice(0, 200)}` : '',
      c.signatureDetails ? `  Signature: ${c.signatureDetails.slice(0, 200)}` : '',
      c.avoidDescription ? `  Avoid: ${c.avoidDescription.slice(0, 200)}` : ''
    ].filter(Boolean)
    charLines.push(bits.join('\n'))
  }

  const sceneIds = new Set<string>()
  let sceneLines: string[] = []
  let sceneCount = 0
  try {
    const scenes = await pb.collection('creative_scenes').getFullList({
      filter: `project = "${projectId}"`,
      sort: 'sort_order'
    })
    sceneCount = scenes.length
    sceneLines = (scenes as Array<Record<string, unknown>>).slice(0, 24).map((s, i) => {
      const mapped = pbRecordToCreativeScene(s as Parameters<typeof pbRecordToCreativeScene>[0])
      if (mapped.id) sceneIds.add(mapped.id)
      const h = mapped.heading.trim() || `Scene ${i + 1}`
      const sum = mapped.summary.trim().slice(0, 200)
      const idTag = mapped.id ? `scene_id=${mapped.id}` : ''
      const head = idTag ? `${i + 1}. [${idTag}] ${h}` : `${i + 1}. ${h}`
      return sum ? `${head} — ${sum}` : head
    })
  } catch {
    sceneLines = []
  }

  const characterIds = new Set<string>([...characterIdsByName.values()])
  const hasStory = Boolean(project.synopsis?.trim() || project.treatment?.trim())
  const directorReady = Boolean(
    director?.style?.trim() ||
      director?.tone?.trim() ||
      director?.camera_preferences?.trim()
  )
  const readinessLines = [
    `Story on file: ${hasStory ? 'yes' : 'no — suggest /overview or /tools/script-wizard'}`,
    `Characters: ${characterIds.size}`,
    `Scenes: ${sceneCount}`,
    `Director bible started: ${directorReady ? 'yes' : 'no — suggest /director'}`,
    `Continuity memory: ${project.continuityMemory?.trim() ? 'yes' : 'empty'}`
  ]

  return {
    projectBlock: projectLines.join('\n\n'),
    charactersBlock: charLines.length ? charLines.join('\n\n') : '(No characters yet)',
    scenesBlock: sceneLines.length ? sceneLines.join('\n') : '(No scenes yet)',
    readinessBlock: readinessLines.join('\n'),
    characterIdsByName,
    sceneIds,
    characterIds
  }
}
