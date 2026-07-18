import { createError, getRouterParam, readBody } from 'h3'
import type PocketBase from 'pocketbase'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { loadWorkflowScreenplayParsedForProject } from '~/server/utils/import-script-core'
import { isMetaCastCharacterEntry } from '~/lib/screenplay-character-filter'
import {
  filterLikelyCharacterNames,
  heuristicCharacterNamesFromScenes
} from '~/server/utils/parse-script-txt'
import {
  formatPocketBaseRecordError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import { formatDirectorForAiPrompt, parseDirectorField } from '~/server/utils/creative-project-map'
import { enrichFixedCharacterRosterWithAi } from '~/server/utils/script-import-ai'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import { resolveProjectPreferredOpenRouterModel } from '~/server/utils/project-model-preference'
import { OPENROUTER_TEXT_MODEL_MAP } from '~/server/utils/openrouter-text-models'

async function listProjectCharacterRows (
  pb: PocketBase,
  projectId: string,
  ownerId: string
): Promise<unknown[]> {
  try {
    return await pb.collection('creative_characters').getFullList({
      filter: `project="${projectId}"`,
      batch: 200
    })
  } catch (e: unknown) {
    if (pocketBaseErrorStatus(e) === 400) {
      const all = await pb.collection('creative_characters').getFullList({
        filter: `owned_by="${ownerId}"`,
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
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const { userId, pb, access } = await requireProjectOwner(event, projectId)

  const body = await readBody<{ assetId?: string }>(event).catch(() => ({}))
  const rawAsset = typeof body?.assetId === 'string' ? body.assetId.trim() : ''
  const assetId = rawAsset || undefined

  const projectRow = await pb.collection('creative_projects').getOne(projectId)

  const { parsed } = await loadWorkflowScreenplayParsedForProject({
    userId,
    pb,
    projectId,
    assetId
  })

  let rows = await listProjectCharacterRows(pb, projectId, access.ownerId)
  let seeded = 0
  let removedMeta = 0

  for (const row of [...rows]) {
    const rec = row as Record<string, unknown>
    const name = String(rec.name || '').trim()
    const desc = String(rec.role_description || '').trim()
    if (!isMetaCastCharacterEntry(name, desc)) continue
    const id = String(rec.id || '')
    if (!id) continue
    try {
      await pb.collection('creative_characters').delete(id)
      removedMeta++
    } catch (e: unknown) {
      console.warn('[characters enrich] removed meta cast row failed:', id, formatPocketBaseRecordError(e))
    }
  }
  if (removedMeta > 0) {
    rows = await listProjectCharacterRows(pb, projectId, access.ownerId)
  }

  const scriptNames = filterLikelyCharacterNames([
    ...parsed.characterNames,
    ...heuristicCharacterNamesFromScenes(parsed.scenes)
  ])
  const existingNorm = new Set(
    rows
      .map((r) => String((r as { name?: string }).name || '').trim().toLowerCase())
      .filter(Boolean)
  )
  for (const name of scriptNames.slice(0, 64)) {
    const n = name.slice(0, 200).trim()
    if (!n || isMetaCastCharacterEntry(n)) continue
    if (existingNorm.has(n.toLowerCase())) continue
    try {
      await pb.collection('creative_characters').create({
        owned_by: access.ownerId,
        project: projectId,
        name: n,
        role_description: ''
      })
      existingNorm.add(n.toLowerCase())
      seeded++
    } catch (e: unknown) {
      console.warn('[characters enrich] seed create failed:', n, formatPocketBaseRecordError(e))
    }
  }
  if (seeded > 0 || !rows.length) {
    rows = await listProjectCharacterRows(pb, projectId, access.ownerId)
  }

  if (!rows.length) {
    if (!scriptNames.length) {
      throwApiError(
        400,
        ApiErrorCode.VALIDATION_ERROR,
        'No characters were found in the screenplay file. Upload a script on Overview, or add cast rows manually.',
        { projectId }
      )
    }
    throwApiError(
      500,
      ApiErrorCode.SERVICE_UNAVAILABLE,
      'Could not create character rows from the screenplay. Check creative_characters rules in PocketBase.',
      { projectId }
    )
  }

  const sceneOutline = parsed.scenes
    .map((s, i) => `## Scene ${i}\nHeading: ${s.heading}\n---\n${s.body.slice(0, 4000)}`)
    .join('\n\n')
    .slice(0, 48_000)

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

  const pref = resolveProjectPreferredOpenRouterModel(pr)
  const modelCandidates = [...new Set([
    pref.openrouterModelId,
    OPENROUTER_TEXT_MODEL_MAP.Claude,
    OPENROUTER_TEXT_MODEL_MAP.ChatGPT
  ])].filter(Boolean)
  let aiRows: Awaited<ReturnType<typeof enrichFixedCharacterRosterWithAi>> = []
  let modelWarning = ''
  for (const slug of modelCandidates) {
    aiRows = await enrichFixedCharacterRosterWithAi({
      projectName,
      synopsis,
      treatment,
      genre,
      tone,
      sceneOutline,
      characterNames: dbNames,
      directorContext,
      openrouterModelId: slug
    })
    if (aiRows.length > 0) {
      modelWarning = ''
      break
    }
    modelWarning = `No usable cast output from model (${slug}).`
  }

  if (!aiRows.length) {
    const refreshed = await listProjectCharacterRows(pb, projectId, access.ownerId)
    refreshed.sort((a, b) => {
      const ra = a as Record<string, unknown>
      const rb = b as Record<string, unknown>
      return String(ra.name || '').localeCompare(String(rb.name || ''))
    })
    const characters = refreshed.map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))
    return {
      updated: 0,
      seeded,
      warning:
        modelWarning ||
        'Model returned no usable character details this run. Try another model or run Analyze script first.',
      characters
    }
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
    const refreshed = await listProjectCharacterRows(pb, projectId, access.ownerId)
    refreshed.sort((a, b) => {
      const ra = a as Record<string, unknown>
      const rb = b as Record<string, unknown>
      return String(ra.name || '').localeCompare(String(rb.name || ''))
    })
    const characters = refreshed.map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))
    return {
      updated: 0,
      seeded,
      warning:
        modelWarning ||
        'Model output did not match current cast names. Edit names to match screenplay cues, then refresh again.',
      characters
    }
  }

  const refreshed = await listProjectCharacterRows(pb, projectId, access.ownerId)

  refreshed.sort((a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    const pa =
      typeof ra.screen_share_percent === 'number' ? ra.screen_share_percent : Number(ra.screen_share_percent)
    const pbPct =
      typeof rb.screen_share_percent === 'number' ? rb.screen_share_percent : Number(rb.screen_share_percent)
    const na = Number.isFinite(pa) ? pa : -1
    const nb = Number.isFinite(pbPct) ? pbPct : -1
    if (nb !== na) return nb - na
    return String(ra.name || '').localeCompare(String(rb.name || ''))
  })

  const characters = refreshed.map((r) => pbRecordToCreativeCharacter(r as Record<string, unknown>))

  return { updated, seeded, characters }
})
