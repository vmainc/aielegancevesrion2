import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import {
  parseScriptBufferToParsed,
  runFullImportFromParsed,
  type AspectRatio,
  type ProjectGoal,
  type ScriptImportPrefillEnrichment
} from '~/server/utils/import-script-core'
import { resolveScriptWizardSource } from '~/server/utils/resolve-script-wizard-source'
import {
  completeScriptImportJob,
  failScriptImportJob
} from '~/server/utils/script-import-job-registry'

function parseThemes (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(t => String(t || '').trim()).filter(Boolean).slice(0, 20)
}

function prefillFromWizardRow (row: Record<string, unknown>): ScriptImportPrefillEnrichment | undefined {
  const treatment = String(row.treatment || '').trim()
  const synopsis = String(row.synopsis || '').trim()
  if (treatment.length < 200 && synopsis.length < 200) return undefined
  return {
    synopsis: synopsis || treatment.slice(0, 20_000),
    treatment: treatment.slice(0, 50_000),
    genre: String(row.genre || '').slice(0, 200),
    tone: String(row.tone || '').slice(0, 500),
    themes: parseThemes(row.themes)
  }
}

export async function runOpenAsProjectImportJob (input: {
  jobId: string
  userId: string
  scriptId: string
  aspectRatio: AspectRatio
  goal: ProjectGoal
}): Promise<void> {
  const { jobId, userId, scriptId, aspectRatio, goal } = input
  try {
    const pb = await getAuthenticatedPocketBase()
    const resolved = await resolveScriptWizardSource(pb, userId, scriptId)
    const row = resolved.row

    const title = resolved.title
    const scriptText = resolved.scriptText.trim()
    if (!scriptText) {
      failScriptImportJob(jobId, 'No script text to import.')
      return
    }

    const filename =
      String(row.source_filename || 'script-wizard.txt').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) ||
      'script-wizard.txt'
    const fileBuf = Buffer.from(scriptText, 'utf8')
    const parsed = await parseScriptBufferToParsed(fileBuf, filename)
    const prefillEnrichment = prefillFromWizardRow(row)

    const { project, scriptAsset } = await runFullImportFromParsed({
      userId,
      pb,
      fileBuf,
      filename,
      parsed,
      aspectRatio,
      goal,
      newProjectName: title.slice(0, 500),
      reuseAssetId: null,
      prefillEnrichment
    })

    completeScriptImportJob(jobId, {
      projectId: project.id,
      project,
      scriptAsset
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    failScriptImportJob(jobId, msg || 'Import failed')
  }
}
