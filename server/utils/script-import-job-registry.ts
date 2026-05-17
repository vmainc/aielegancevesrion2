import type { StoryboardSeedResult } from '~/server/utils/import-storyboard-seed'
import type { CreativeProject } from '~/types/creative-project'
import type { ScriptAssetAttachResult } from '~/server/utils/import-script-core'

export type ScriptImportJobStatus = 'running' | 'completed' | 'failed'

export type ScriptImportJobRecord = {
  userId: string
  status: ScriptImportJobStatus
  createdAt: number
  projectId?: string
  project?: CreativeProject
  scriptAsset?: ScriptAssetAttachResult
  storyboard?: StoryboardSeedResult
  sceneCount?: number
  error?: string
}

const jobs = new Map<string, ScriptImportJobRecord>()
const TTL_MS = 35 * 60 * 1000

function prune () {
  const now = Date.now()
  for (const [id, v] of jobs) {
    if (now - v.createdAt > TTL_MS) jobs.delete(id)
  }
}

export function createScriptImportJob (userId: string): string {
  prune()
  const jobId = crypto.randomUUID()
  jobs.set(jobId, { userId, status: 'running', createdAt: Date.now() })
  return jobId
}

export function getScriptImportJob (jobId: string, userId: string): ScriptImportJobRecord | null {
  prune()
  const row = jobs.get(jobId.trim())
  if (!row || row.userId !== userId) return null
  return row
}

export function completeScriptImportJob (
  jobId: string,
  result: {
    projectId: string
    project: CreativeProject
    scriptAsset: ScriptAssetAttachResult
    storyboard?: StoryboardSeedResult
    sceneCount?: number
  }
): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), {
    ...row,
    status: 'completed',
    projectId: result.projectId,
    project: result.project,
    scriptAsset: result.scriptAsset,
    storyboard: result.storyboard,
    sceneCount: result.sceneCount
  })
}

export function failScriptImportJob (jobId: string, message: string): void {
  const row = jobs.get(jobId.trim())
  if (!row) return
  jobs.set(jobId.trim(), { ...row, status: 'failed', error: message.slice(0, 2000) })
}
