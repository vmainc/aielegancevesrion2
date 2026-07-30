import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getSpeechToTextJob } from '~/server/utils/speech-to-text-store'
import { countTranscriptWords } from '~/lib/speech-to-text'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const jobId = getRouterParam(event, 'jobId')
  if (!jobId?.trim()) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing job id')
  }

  const job = getSpeechToTextJob(jobId)
  if (!job) {
    throwApiError(404, ApiErrorCode.NOT_FOUND, 'Transcription job not found or expired.')
  }
  if (job.userId !== userId) {
    throwApiError(403, ApiErrorCode.FORBIDDEN, 'You do not have access to this transcription job.')
  }

  if (job.status === 'completed' && job.result) {
    return {
      status: 'completed' as const,
      phase: 'transcribing' as const,
      filename: job.filename,
      size: job.size,
      options: job.options,
      result: {
        ...job.result,
        wordCount: countTranscriptWords(job.result.text)
      },
      completedAt: job.completedAt
        ? new Date(job.completedAt).toISOString()
        : undefined
    }
  }

  if (job.status === 'failed') {
    return {
      status: 'failed' as const,
      phase: job.phase || 'transcribing',
      filename: job.filename,
      size: job.size,
      options: job.options,
      message: job.message || 'Transcription failed.',
      completedAt: job.completedAt
        ? new Date(job.completedAt).toISOString()
        : undefined
    }
  }

  return {
    status: job.status,
    phase: job.phase || 'transcribing',
    filename: job.filename,
    size: job.size,
    options: job.options,
    message: 'Longer recordings may take a few minutes. Keep this tab open.'
  }
})
