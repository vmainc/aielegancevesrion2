import type { CreativeProject } from '~/types/creative-project'
import type { ScriptAssetAttachResult } from '~/server/utils/import-script-core'

export type ScriptAnalyzeJobStatus = 'running' | 'completed' | 'failed'
export type ScriptAnalyzeJobKind = 'preview' | 'apply'

export interface ScriptAnalyzeCandidate {
  modelId: string
  label: string
  synopsis?: string
  treatment?: string
  genre?: string
  tone?: string
  error?: string
}

export interface ScriptAnalyzeJobRecord {
  userId: string
  kind: ScriptAnalyzeJobKind
  status: ScriptAnalyzeJobStatus
  createdAt: number
  /** preview result */
  candidates?: ScriptAnalyzeCandidate[]
  assetId?: string
  /** apply / default result */
  project?: CreativeProject
  scriptAsset?: ScriptAssetAttachResult
  error?: string
}

const jobs = new Map<string, ScriptAnalyzeJobRecord>()
const TTL_MS = 35 * 60 * 1000

function prune () {
  const now = Date.now()
  for (const [id, v] of jobs) {
    if (now - v.createdAt > TTL_MS) jobs.delete(id)
  }
}

export function createScriptAnalyzeJob (userId: string, kind: ScriptAnalyzeJobKind): string {
  prune()
  const jobId = crypto.randomUUID()
  jobs.set(jobId, { userId, kind, status: 'running', createdAt: Date.now() })
  return jobId
}

export function getScriptAnalyzeJob (jobId: string, userId: string): ScriptAnalyzeJobRecord | null {
  prune()
  const row = jobs.get(jobId.trim())
  if (!row || row.userId !== userId) return null
  return row
}

export function completeScriptAnalyzePreviewJob (
  jobId: string,
  result: { candidates: ScriptAnalyzeCandidate[]; assetId?: string }
): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), {
    ...row,
    status: 'completed',
    candidates: result.candidates,
    assetId: result.assetId
  })
}

export function completeScriptAnalyzeApplyJob (
  jobId: string,
  result: { project: CreativeProject; scriptAsset: ScriptAssetAttachResult }
): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), {
    ...row,
    status: 'completed',
    project: result.project,
    scriptAsset: result.scriptAsset
  })
}

export function failScriptAnalyzeJob (jobId: string, message: string): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), { ...row, status: 'failed', error: message.slice(0, 2000) })
}
