import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  parseScriptBufferToParsed,
  runFullImportFromParsed
} from '~/server/utils/import-script-core'
import { resolveScriptWizardSource } from '~/server/utils/resolve-script-wizard-source'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing script id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    aspectRatio?: string
    goal?: string
  } | null

  const aspectRatio =
    typeof body?.aspectRatio === 'string' && ASPECT.has(body.aspectRatio as ProjectAspectRatio)
      ? (body.aspectRatio as ProjectAspectRatio)
      : '16:9'
  const goal =
    typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)
      ? (body.goal as ProjectGoal)
      : 'film'

  const pb = await getAuthenticatedPocketBase()
  const resolved = await resolveScriptWizardSource(pb, userId, id)
  const row = resolved.row

  const title = resolved.title
  const scriptText = resolved.scriptText.trim()
  if (!scriptText) {
    throw createError({
      statusCode: 400,
      message: 'No script text to import. Add screenplay content in Script Wizard first.'
    })
  }

  const filename =
    String(row.source_filename || 'script-wizard.txt').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) ||
    'script-wizard.txt'
  const fileBuf = Buffer.from(scriptText, 'utf8')
  const parsed = await parseScriptBufferToParsed(fileBuf, filename)

  const { project, scriptAsset } = await runFullImportFromParsed({
    userId,
    pb,
    fileBuf,
    filename,
    parsed,
    aspectRatio,
    goal,
    newProjectName: title.slice(0, 500),
    reuseAssetId: null
  })

  return {
    projectId: project.id,
    project,
    scriptAsset,
    importComplete: true
  }
})
