import { createError, readMultipartFormData } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  parseScriptBufferToParsed,
  uploadScriptFileToProject
} from '~/server/utils/import-script-core'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { initialConceptNotesForWorkflow } from '~/lib/project-workflow-mode'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'

/**
 * Unified script import: create a cloud project and attach the screenplay in one step.
 * Replaces the Script Wizard → open-as-project detour for new uploads.
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'script-import-to-project'), 6, 60_000)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'Expected multipart upload with a "file" field' })
  }

  let fileBuf: Buffer | null = null
  let filename = 'script'
  let name = ''
  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'file' && part.data?.length) {
      fileBuf = part.data
      filename = (part.filename && part.filename.trim()) || 'script.upload'
    }
    if (part.name === 'name' && part.data) {
      name = part.data.toString('utf8').trim()
    }
  }
  if (!fileBuf?.length) {
    throw createError({ statusCode: 400, message: 'Missing script file' })
  }

  const lower = filename.toLowerCase()
  if (!lower.endsWith('.fdx') && !lower.endsWith('.txt') && !lower.endsWith('.pdf')) {
    throw createError({ statusCode: 400, message: 'Only .fdx, .txt, and .pdf files are supported' })
  }

  let parsed
  try {
    parsed = await parseScriptBufferToParsed(fileBuf, filename)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 400, message: msg || 'Could not parse script' })
  }

  const projectName =
    name ||
    filename.replace(/\.[^.]+$/, '') ||
    'Imported script'

  const pb = await getAuthenticatedPocketBase()

  try {
    const created = await pb.collection('creative_projects').create({
      name: projectName.slice(0, 500),
      owned_by: userId,
      aspect_ratio: '16:9',
      goal: 'film',
      preferred_model_id: 'claude',
      target_length: 'short',
      workflow_mode: 'import',
      synopsis: '',
      treatment: '',
      concept_notes: initialConceptNotesForWorkflow('import')
    })

    const projectId = created.id
    await uploadScriptFileToProject({
      pb,
      userId,
      projectId,
      fileBuf,
      filename
    })

    const full = await pb.collection('creative_projects').getOne(projectId)
    const project = pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])

    return {
      project,
      sceneCount: parsed.scenes?.length ?? 0,
      redirectPath: `/projects/${projectId}/overview`
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_projects collection is missing. Run npm run setup-db.'
      })
    }
    throw e
  }
})
