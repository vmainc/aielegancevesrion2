import { getRequestURL } from 'h3'
import { VIDEO_REPAIR_DEFAULTS } from '~/lib/video-repair/limits'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  getLumaModifyModel,
  getVideoRepairDefaultModel,
  getVideoRepairDefaultProvider,
  getVideoRepairLimits,
  resolveLumaApiKey
} from '~/server/utils/video-repair-config'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

export default defineEventHandler(async (event) => {
  await getPocketBaseUserIdFromRequest(event)
  const config = useRuntimeConfig()
  const limits = getVideoRepairLimits()
  const lumaKey = resolveLumaApiKey(config)
  const openRouterKey = resolveOpenRouterApiKey(config)
  const origin = getRequestURL(event).origin

  return {
    limits: {
      maxDurationSeconds: limits.maxDurationSeconds,
      maxUploadMb: limits.maxUploadMb,
      maxConcurrentJobs: limits.maxConcurrentJobs,
      allowedMime: ['video/mp4', 'video/quicktime', 'video/webm']
    },
    engines: {
      defaultProvider: getVideoRepairDefaultProvider(),
      defaultModel: getVideoRepairDefaultModel(),
      lumaConfigured: Boolean(lumaKey),
      lumaModel: getLumaModifyModel(),
      openRouterConfigured: Boolean(openRouterKey),
      autoLabel: 'Auto',
      openrouterLabel: 'Runway Aleph',
      lumaLabel: 'Luma Modify'
    },
    defaults: VIDEO_REPAIR_DEFAULTS,
    requestOrigin: origin
  }
})
