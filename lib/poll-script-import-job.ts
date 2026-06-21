export async function pollScriptImportJob (
  jobId: string,
  headers: Record<string, string>,
  options?: { intervalMs?: number; maxMs?: number }
): Promise<{
  projectId: string
  project: import('~/types/creative-project').CreativeProject
  scriptAsset?: import('~/server/utils/import-script-core').ScriptAssetAttachResult
}> {
  const intervalMs = options?.intervalMs ?? 3500
  const maxMs = options?.maxMs ?? 30 * 60 * 1000
  const started = Date.now()

  while (Date.now() - started < maxMs) {
    const res = await $fetch<{
      status: string
      projectId?: string
      project?: import('~/types/creative-project').CreativeProject
      scriptAsset?: import('~/server/utils/import-script-core').ScriptAssetAttachResult
      message?: string
    }>(`/api/script-import/jobs/${encodeURIComponent(jobId)}`, { headers })

    if (res.status === 'completed' && res.projectId && res.project) {
      return {
        projectId: res.projectId,
        project: res.project,
        scriptAsset: res.scriptAsset
      }
    }
    if (res.status === 'failed') {
      throw new Error(res.message || 'Script import failed')
    }

    await new Promise(r => setTimeout(r, intervalMs))
  }

  throw new Error('Script import timed out while waiting for the server. Check Projects — it may still be running.')
}
