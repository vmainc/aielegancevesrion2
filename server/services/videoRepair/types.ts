import type {
  RepairMode,
  VideoRepairJob,
  VideoRepairJobStatus,
  VideoRepairProviderId,
  VideoRepairReferenceFrame
} from '~/lib/video-repair/types'

export type {
  RepairMode,
  VideoRepairJob,
  VideoRepairJobStatus,
  VideoRepairProviderId,
  VideoRepairReferenceFrame
}

export type VideoRepairProviderStartInput = {
  sourceVideoUrl: string
  prompt: string
  referenceFrames: VideoRepairReferenceFrame[]
  repairMode: RepairMode
  durationSeconds?: number
  /** True when durationSeconds came from ffprobe (or another reliable probe). */
  durationTrusted?: boolean
  model: string
  aspectRatio?: string
  /** HTTPS URL providers can fetch (tokenized public media). */
  publicSourceVideoUrl?: string
  publicReferenceImageUrl?: string
}

export type VideoRepairProviderStartResult = {
  providerJobId: string
  pollUrl: string
  model: string
  status: VideoRepairJobStatus
  outputVideoUrl?: string
  actualCost?: number | null
}

export type VideoRepairProviderPollResult =
  | { status: 'pending' | 'in_progress'; providerJobId: string; model: string }
  | {
      status: 'completed'
      providerJobId: string
      model: string
      outputVideoUrl: string
      actualCost?: number | null
    }
  | {
      status: 'failed' | 'cancelled' | 'expired'
      providerJobId: string
      model: string
      message: string
    }

export interface VideoRepairProviderAdapter {
  id: VideoRepairProviderId
  start (input: VideoRepairProviderStartInput): Promise<VideoRepairProviderStartResult>
  poll (pollUrl: string, providerJobId: string, model: string): Promise<VideoRepairProviderPollResult>
}

export type RepairVideoInput = {
  sourceVideo: string
  prompt: string
  referenceFrames: VideoRepairReferenceFrame[]
  repairMode: RepairMode
  duration?: number
  durationTrusted?: boolean
  provider: VideoRepairProviderId
  model: string
  aspectRatio?: string
  publicSourceVideoUrl?: string
  publicReferenceImageUrl?: string
}

export function normalizeRepairJob (partial: VideoRepairJob): VideoRepairJob {
  return {
    id: partial.id,
    provider: partial.provider,
    model: partial.model,
    status: partial.status,
    sourceVideo: partial.sourceVideo,
    outputVideo: partial.outputVideo,
    createdAt: partial.createdAt,
    completedAt: partial.completedAt,
    error: partial.error,
    estimatedCost: partial.estimatedCost,
    actualCost: partial.actualCost,
    durationSeconds: partial.durationSeconds
  }
}
