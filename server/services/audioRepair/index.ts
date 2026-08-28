/**
 * Audio / voice consistency repair — separate from visual Fix Shot.
 * Voice identity is not sent through video-generation models.
 */

export type AudioRepairStatus = 'not_implemented'

export type AudioRepairRequest = {
  sourceAudioUrl: string
  prompt: string
  referenceVoiceUrl?: string
}

export type AudioRepairResult = {
  status: AudioRepairStatus
  message: string
}

export function audioRepairUnavailableMessage (): string {
  return 'Voice repair is handled separately from visual repair.'
}

export async function repairAudio (_request: AudioRepairRequest): Promise<AudioRepairResult> {
  return {
    status: 'not_implemented',
    message: audioRepairUnavailableMessage()
  }
}
