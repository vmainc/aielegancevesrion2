export type FixShotPrefill = {
  projectId?: string
  sceneId?: string
  shotId?: string
  assetId?: string
}

export function navigateToFixShot (opts: FixShotPrefill): Promise<ReturnType<typeof navigateTo>> {
  const query: Record<string, string> = {}
  if (opts.projectId) query.projectId = opts.projectId
  if (opts.sceneId) query.sceneId = opts.sceneId
  if (opts.shotId) query.shotId = opts.shotId
  if (opts.assetId) query.assetId = opts.assetId
  return navigateTo({
    path: '/tools/fix-shot',
    query
  })
}
