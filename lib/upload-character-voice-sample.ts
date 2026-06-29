import type { ProjectAsset } from '~/types/project-asset'

const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg'
])

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime'
])

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export function isVideoReferenceFile (file: File): boolean {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return VIDEO_TYPES.has(type) || /\.(mp4|webm|mov)$/i.test(name)
}

export function validateCharacterReferenceClipFile (file: File): string | null {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const isVideo = isVideoReferenceFile(file)
  const isAudio =
    AUDIO_TYPES.has(type) ||
    /\.(mp3|wav|m4a|webm|ogg)$/i.test(name)

  if (!isVideo && !isAudio) {
    return 'Choose an audio file (MP3, WAV, M4A) or a short video (MP4, WebM, MOV).'
  }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
  if (file.size > max) {
    return isVideo
      ? 'Video is too large (max 50MB). Trim to ~10–15 seconds.'
      : 'Audio is too large (max 25MB). Use a shorter clip (~10 seconds).'
  }
  return null
}

/** @deprecated Use validateCharacterReferenceClipFile */
export function validateCharacterVoiceSampleFile (file: File): string | null {
  return validateCharacterReferenceClipFile(file)
}

export async function uploadCharacterReferenceClip (input: {
  projectId: string
  characterId: string
  characterName: string
  file: File
  token: string
  mannerismLabel?: string
}): Promise<ProjectAsset> {
  const err = validateCharacterReferenceClipFile(input.file)
  if (err) throw new Error(err)

  const isVideo = isVideoReferenceFile(input.file)
  const label = (input.mannerismLabel || '').trim()
  const titleSuffix = isVideo
    ? (label || 'performance')
    : 'voice sample'

  const fd = new FormData()
  fd.append('file', input.file)
  fd.append('kind', 'character')
  fd.append(
    'title',
    `${input.characterName.trim() || 'Character'} — ${titleSuffix}`.slice(0, 500)
  )
  fd.append(
    'metadata',
    JSON.stringify({
      source: isVideo ? 'character_performance_clip' : 'character_voice_sample',
      media_type: isVideo ? 'video' : 'audio',
      character_name: input.characterName.trim(),
      character_id: input.characterId,
      ...(label ? { mannerism_label: label } : {})
    })
  )

  const res = await $fetch<{ asset: ProjectAsset }>(
    `/api/projects/${input.projectId}/assets/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.token}` },
      body: fd
    }
  )

  return res.asset
}

/** @deprecated Use uploadCharacterReferenceClip */
export async function uploadCharacterVoiceSample (input: {
  projectId: string
  characterId: string
  characterName: string
  file: File
  token: string
}): Promise<ProjectAsset> {
  return uploadCharacterReferenceClip(input)
}
