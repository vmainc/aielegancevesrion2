import type { CreativeProject } from '~/types/creative-project'
import type { ScriptAssetAttachResult } from '~/server/utils/import-script-core'

export interface ScriptAnalyzeCandidateResult {
  modelId: string
  label: string
  synopsis?: string
  treatment?: string
  genre?: string
  tone?: string
  error?: string
}

export type ScriptAnalyzePollResult =
  | { kind: 'preview'; candidates: ScriptAnalyzeCandidateResult[]; assetId?: string }
  | { kind: 'apply'; project: CreativeProject; scriptAsset?: ScriptAssetAttachResult }

export async function pollScriptAnalyzeJob (
  jobId: string,
  headers: Record<string, string>,
  options?: { intervalMs?: number; maxMs?: number }
): Promise<ScriptAnalyzePollResult> {
  const intervalMs = options?.intervalMs ?? 3500
  const maxMs = options?.maxMs ?? 30 * 60 * 1000
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    const res = await $fetch<{
      status: string
      kind?: 'preview' | 'apply'
      candidates?: ScriptAnalyzeCandidateResult[]
      assetId?: string
      project?: CreativeProject
      scriptAsset?: ScriptAssetAttachResult
      message?: string
    }>(`/api/script-analyze/jobs/${encodeURIComponent(jobId)}`, { headers })

    if (res.status === 'completed') {
      if (res.kind === 'preview') {
        return { kind: 'preview', candidates: res.candidates ?? [], assetId: res.assetId }
      }
      if (res.project) {
        return { kind: 'apply', project: res.project, scriptAsset: res.scriptAsset }
      }
      throw new Error('Analysis completed without a result')
    }
    if (res.status === 'failed') {
      throw new Error(res.message || 'Analysis failed')
    }

    await new Promise(r => setTimeout(r, intervalMs))
  }

  throw new Error('Analysis timed out while waiting for the server. It may still be running — reload the project.')
}
