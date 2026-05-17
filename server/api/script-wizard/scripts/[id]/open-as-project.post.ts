import { createError, getRouterParam, readBody } from 'h3'
import { IMPORTED_SCRIPT_TREATMENT_MARKER } from '~/lib/project-workflow'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { resolveScriptWizardSource } from '~/server/utils/resolve-script-wizard-source'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])

function parseThemes (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(t => String(t || '').trim()).filter(Boolean).slice(0, 20)
}

function treatmentForProject (treatment: string): string {
  const t = treatment.trim()
  if (!t) return ''
  if (t.includes(IMPORTED_SCRIPT_TREATMENT_MARKER)) return t.slice(0, 50_000)
  return `${IMPORTED_SCRIPT_TREATMENT_MARKER}\n\n${t}`.slice(0, 50_000)
}

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
  const synopsis = String(row.synopsis || resolved.scriptText.slice(0, 2000)).slice(0, 20_000)
  const treatment = treatmentForProject(resolved.existingTreatment || String(row.treatment || ''))
  const genre = String(row.genre || '').slice(0, 200)
  const tone = String(row.tone || '').slice(0, 500)
  const themes = parseThemes(row.themes)

  let created
  try {
    created = await pb.collection('creative_projects').create({
      name: title.slice(0, 500),
      owned_by: userId,
      aspect_ratio: aspectRatio,
      goal,
      workflow_mode: 'import',
      preferred_model_id: 'claude',
      target_length: 'short',
      synopsis,
      treatment,
      genre,
      tone,
      themes,
      concept_notes: `Opened from Script Wizard (${id}).`
    })
  } catch (createErr: unknown) {
    const msg = createErr instanceof Error ? createErr.message : String(createErr)
    if (!/workflow_mode/i.test(msg)) throw createErr
    created = await pb.collection('creative_projects').create({
      name: title.slice(0, 500),
      owned_by: userId,
      aspect_ratio: aspectRatio,
      goal,
      preferred_model_id: 'claude',
      target_length: 'short',
      synopsis,
      treatment,
      genre,
      tone,
      themes,
      concept_notes: `Opened from Script Wizard (${id}).`
    })
  }

  const projectId = String(created.id)
  const scriptText = resolved.scriptText.trim() || synopsis
  const fileBuf = Buffer.from(scriptText, 'utf8')
  const safeFilename =
    String(row.source_filename || 'script-wizard.txt').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) ||
    'script-wizard.txt'

  const assetForm = new FormData()
  assetForm.append('owned_by', userId)
  assetForm.append('project', projectId)
  assetForm.append('kind', 'script')
  assetForm.append('title', title.slice(0, 500))
  assetForm.append(
    'notes',
    `Opened from Script Wizard. ${themes.length ? `${themes.length} theme(s) in analysis.` : 'Run Characters when ready.'}`.slice(0, 8000)
  )
  assetForm.append('sort_order', '0')
  assetForm.append(
    'metadata',
    JSON.stringify({
      source: 'script_import',
      creative_script_id: resolved.kind === 'creative_script' ? id : undefined,
      script_title: title,
      source_filename: safeFilename,
      synopsis,
      treatment,
      genre,
      tone,
      themes
    })
  )
  assetForm.append('file', new Blob([fileBuf], { type: 'text/plain' }), safeFilename)

  try {
    await pb.collection('project_assets').create(assetForm)
  } catch {
    const legacy = new FormData()
    legacy.append('owned_by', userId)
    legacy.append('project', projectId)
    legacy.append('kind', 'script')
    legacy.append('title', title.slice(0, 500))
    legacy.append('notes', `Opened from Script Wizard.`.slice(0, 8000))
    legacy.append('file', new Blob([fileBuf], { type: 'text/plain' }), safeFilename)
    await pb.collection('project_assets').create(legacy)
  }

  const full = await pb.collection('creative_projects').getOne(projectId)
  const project = pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
  return { projectId, project }
})
