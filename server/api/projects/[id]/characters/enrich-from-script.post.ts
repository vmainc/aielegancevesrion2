import { createError, getRouterParam, readBody } from 'h3'
import type PocketBase from 'pocketbase'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { loadWorkflowScreenplayParsedForProject } from '~/server/utils/import-script-core'
import {
  filterLikelyCharacterNames,
  heuristicCharacterNamesFromScenes
} from '~/server/utils/parse-script-txt'
import {
  formatPocketBaseRecordError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { formatDirectorForAiPrompt, parseDirectorField } from '~/server/utils/creative-project-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { enrichFixedCharacterRosterWithAi } from '~/server/utils/script-import-ai'

async function listProjectCharacterRows (
  pb: PocketBase,
  projectId: string,
  userId: string
): Promise<unknown[]> {
  try {
    return await pb.collection('creative_characters').getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 400) {
      const all = await pb.collection('creative_characters').getFullList({
        filter: `owned_by="${userId}"`,
        batch: 400
      })
      return all.filter((r) => projectIdOnCharacterRow(r as Record<string, unknown>) === projectId)
    }
    throw e
  }
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const body = await readBody<{ assetId?: string }>(event).catch(() => ({}))
  const rawAsset = typeof body?.assetId === 'string' ? body.assetId.trim() : ''
  const assetId = rawAsset || undefined

  const projectRow = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const { parsed } = await loadWorkflowScreenplayParsedForProject({
    userId,
    pb,
    projectId,
    assetId
  })

  let rows = await listProjectCharacterRows(pb, projectId, userId)
  let seeded = 0

  if (!rows.length) {
    const names = filterLikelyCharacterNames([
      ...parsed.characterNames,
      ...heuristicCharacterNamesFromScenes(parsed.scenes)
    ])
    if (!names.length) {
      throw createError({
        statusCode: 400,
        message:
          'No characters were found in the screenplay file. Upload a script on Overview, or add cast rows manually.'
      })
    }
    for (const name of names.slice(0, 48)) {
      const n = name.slice(0, 200).trim()
      if (!n) continue
      try {
        await pb.collection('creative_characters').create({
          owned_by: userId,
          project: projectId,
          name: n,
          role_description: ''
        })
        seeded++
      } catch (e: unknown) {
        console.warn('[characters enrich] seed create failed:', n, formatPocketBaseRecordError(e))
      }
    }
    rows = await listProjectCharacterRows(pb, projectId, userId)
  }

  if (!rows.length) {
    throw createError({
      statusCode: 500,
      message: 'Could not create character rows from the screenplay. Check creative_characters rules in PocketBase.'
    })
  }

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 2500)}`)
    .join('\n\n')

  const pr = projectRow as Record<string, unknown>
  const projectName = String(pr.name || 'Project').trim() || 'Project'
  const synopsis = String(pr.synopsis || '')
  const treatment = String(pr.treatment || '')
  const genre = String(pr.genre || '')
  const tone = String(pr.tone || '')

  const dbNames = rows
    .map((r) => String((r as { name?: string }).name || '').trim())
    .filter(Boolean)

  if (!dbNames.length) {
    throw createError({ statusCode: 400, message: 'No character names to describe.' })
  }

  const directorContext = formatDirectorForAiPrompt(
    parseDirectorField((pr as { director?: unknown }).director)
  )

  const aiRows = await enrichFixedCharacterRosterWithAi({
    projectName,
    synopsis,
    treatment,
    genre,
    tone,
    sceneOutline,
    characterNames: dbNames,
    directorContext
  })

  if (!aiRows.length) {
    throw createError({
      statusCode: 502,
      message:
        'AI did not return usable character data. Check OPENROUTER_API_KEY, or run director analysis on Overview once so synopsis and treatment are filled.'
    })
  }

  const aiByNorm = new Map<string, (typeof aiRows)[0]>()
  for (const r of aiRows) {
    aiByNorm.set(r.name.trim().toLowerCase(), r)
  }

  let updated = 0
  for (const row of rows) {
    const rec = row as Record<string, unknown>
    const id = String(rec.id || '')
    const name = String(rec.name || '').trim()
    if (!id || !name) continue
    const hit = aiByNorm.get(name.toLowerCase())
    if (!hit) continue
    try {
      await pb.collection('creative_characters').update(id, {
        role_description: hit.role_description.slice(0, 10000),
        screen_share_percent: hit.screen_share_percent
      })
      updated++
    } catch (e: unknown) {
      console.warn('[characters enrich] patch failed', id, formatPocketBaseRecordError(e))
    }
  }

  if (updated === 0) {
    throw createError({
      statusCode: 502,
      message:
        'AI names did not match your table rows. Align names with screenplay cues or edit characters, then try again.'
    })
  }

  const refreshed = await listProjectCharacterRows(pb, projectId, userId)

  refreshed.sort((a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    const pa =
      typeof ra.screen_share_percent === 'number' ? ra.screen_share_percent : Number(ra.screen_share_percent)
    const pb =
      typeof rb.screen_share_percent === 'number' ? rb.screen_share_percent : Number(rb.screen_share_percent)
    const na = Number.isFinite(pa) ? pa : -1
    const nb = Number.isFinite(pb) ? pb : -1
    if (nb !== na) return nb - na
    return String(ra.name || '').localeCompare(String(rb.name || ''))
  })

  const characters = refreshed.map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))

  return { updated, seeded, characters }
})
