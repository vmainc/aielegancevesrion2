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
  characterIdsByName: Map<string, string>
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

  let sceneLines: string[] = []
  try {
    const scenes = await pb.collection('creative_scenes').getFullList({
      filter: `project = "${projectId}"`,
      sort: 'sort_order'
    })
    sceneLines = (scenes as Array<Record<string, unknown>>).slice(0, 24).map((s, i) => {
      const mapped = pbRecordToCreativeScene(s as Parameters<typeof pbRecordToCreativeScene>[0])
      const h = mapped.heading.trim() || `Scene ${i + 1}`
      const sum = mapped.summary.trim().slice(0, 200)
      return sum ? `${i + 1}. ${h} — ${sum}` : `${i + 1}. ${h}`
    })
  } catch {
    sceneLines = []
  }

  return {
    projectBlock: projectLines.join('\n\n'),
    charactersBlock: charLines.length ? charLines.join('\n\n') : '(No characters yet)',
    scenesBlock: sceneLines.length ? sceneLines.join('\n') : '(No scenes yet)',
    characterIdsByName
  }
}
