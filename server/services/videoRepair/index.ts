import { createError } from 'h3'
import { createLumaVideoRepairAdapter } from './providers/luma'
import { createOpenRouterVideoRepairAdapter } from './providers/openrouter'
import type {
  RepairVideoInput,
  VideoRepairProviderAdapter,
  VideoRepairProviderPollResult,
  VideoRepairProviderStartResult
} from './types'

export type VideoRepairEngineDeps = {
  openRouterApiKey?: string
  lumaApiKey?: string
}

export function getVideoRepairAdapter (
  provider: 'openrouter' | 'luma',
  deps: VideoRepairEngineDeps
): VideoRepairProviderAdapter {
  if (provider === 'luma') {
    const key = deps.lumaApiKey?.trim()
    if (!key) {
      throw createError({
        statusCode: 500,
        message: 'Luma API key not configured. Set LUMA_API_KEY in .env.'
      })
    }
    return createLumaVideoRepairAdapter(key)
  }
  const key = deps.openRouterApiKey?.trim()
  if (!key) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }
  return createOpenRouterVideoRepairAdapter(key)
}

/**
 * Provider-independent repair entry. Callers must not talk to OpenRouter or Luma directly.
 */
export async function repairVideo (
  input: RepairVideoInput,
  deps: VideoRepairEngineDeps
): Promise<VideoRepairProviderStartResult> {
  const adapter = getVideoRepairAdapter(input.provider, deps)
  return adapter.start({
    sourceVideoUrl: input.sourceVideo,
    prompt: input.prompt,
    referenceFrames: input.referenceFrames,
    repairMode: input.repairMode,
    durationSeconds: input.duration,
    model: input.model,
    aspectRatio: input.aspectRatio,
    publicSourceVideoUrl: input.publicSourceVideoUrl,
    publicReferenceImageUrl: input.publicReferenceImageUrl
  })
}

export async function pollVideoRepair (
  provider: 'openrouter' | 'luma',
  pollUrl: string,
  providerJobId: string,
  model: string,
  deps: VideoRepairEngineDeps
): Promise<VideoRepairProviderPollResult> {
  const adapter = getVideoRepairAdapter(provider, deps)
  return adapter.poll(pollUrl, providerJobId, model)
}

export { lumaModeForRepairMode, normalizeLumaModifyModel } from './providers/luma'
export { buildVideoRepairPrompt } from './promptBuilder'
export type { RepairVideoInput, VideoRepairProviderStartResult } from './types'
