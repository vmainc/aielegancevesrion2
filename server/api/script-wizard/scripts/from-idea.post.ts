import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import { sanitizeCharacterNameList } from '~/lib/screenplay-format'
import { getOrCreateScriptLibraryProjectId } from '~/server/utils/get-or-create-script-library-project'
import { generateScreenplayFromStoryIdea } from '~/server/utils/generate-screenplay-from-idea'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import type { CreativeScript, CreativeScriptStatus } from '~/types/creative-script'
import type { ProjectGoal } from '~/types/creative-project'

const VALID_STATUS = new Set<CreativeScriptStatus>(['draft', 'in_progress', 'final'])

const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    title?: string
    logline?: string
    summary?: string
    hook?: string
    genre?: string
    tone?: string
    modelId?: string
    modelLabel?: string
    status?: string
    characters?: unknown
    goal?: string
  } | null

  const title = String(body?.title || '').trim().slice(0, 500)
  const logline = String(body?.logline || '').trim()
  const summary = String(body?.summary || '').trim()
  if (!title || !summary) {
    throw createError({ statusCode: 400, message: 'title and summary are required' })
  }

  let status: CreativeScriptStatus = 'in_progress'
  if (typeof body?.status === 'string' && VALID_STATUS.has(body.status as CreativeScriptStatus)) {
    status = body.status as CreativeScriptStatus
  }

  const goal =
    typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)
      ? (body.goal as ProjectGoal)
      : 'film'
  const characters = sanitizeCharacterNameList(body?.characters)

  const scriptText = await generateScreenplayFromStoryIdea({
    title,
    logline,
    summary,
    genre: String(body?.genre || '').slice(0, 200),
    tone: String(body?.tone || '').slice(0, 500),
    characters,
    goal
  })
  const synopsis = summary.slice(0, 20000)
  const genre = String(body?.genre || '').slice(0, 200)
  const tone = String(body?.tone || '').slice(0, 500)
  const sourceFilename = 'ai-story-idea.txt'
  const fileSafe = 'ai-story-idea.txt'

  const pb = await getAuthenticatedPocketBase()
  const libProjectId = await getOrCreateScriptLibraryProjectId(pb, userId)
  const textBuf = Buffer.from(scriptText, 'utf8')
  const blob = new Blob([textBuf], { type: 'text/plain' })

  const formData = new FormData()
  formData.append('owned_by', userId)
  formData.append('title', title)
  formData.append('status', status)
  formData.append('source_filename', sourceFilename)
  formData.append('script_text', scriptText.slice(0, 300000))
  formData.append('synopsis', synopsis)
  formData.append('treatment', '')
  formData.append('genre', genre)
  formData.append('tone', tone)
  formData.append('themes', JSON.stringify([]))
  formData.append('comparable_titles', JSON.stringify([]))
  formData.append('file', blob, fileSafe)

  async function createScriptAsset (creativeScriptId: string) {
    const assetForm = new FormData()
    assetForm.append('owned_by', userId)
    assetForm.append('project', libProjectId)
    assetForm.append('kind', 'script')
    assetForm.append('title', title)
    assetForm.append('notes', 'Script Wizard — generated from AI story idea.')
    assetForm.append(
      'metadata',
      JSON.stringify({
        source: 'script_wizard_idea',
        creative_script_id: creativeScriptId,
        script_title: title,
        source_filename: sourceFilename,
        synopsis,
        genre,
        tone,
        status,
        cast_names: characters
      })
    )
    assetForm.append('sort_order', '0')
    assetForm.append('file', blob, fileSafe)
    return pb.collection('project_assets').create(assetForm)
  }

  try {
    const created = await pb.collection('creative_scripts').create(formData)
    const script = pbRecordToCreativeScript(created as Record<string, unknown>)
    try {
      await createScriptAsset(script.id)
    } catch {
      // non-fatal
    }
    return { script }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_scripts collection missing. Run: node scripts/setup-collections.js'
      })
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 500, message: msg })
  }
})
