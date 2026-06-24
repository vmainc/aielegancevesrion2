import type { ProjectAsset } from '~/types/project-asset'

const ACCEPTED_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg'
])

const MAX_BYTES = 52 * 1024 * 1024

export function validateMusicTrackFile (file: File): string | null {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const extOk = /\.(mp3|wav|m4a|webm|ogg)$/i.test(name)
  if (!ACCEPTED_TYPES.has(type) && !extOk) {
    return 'Choose an audio file (MP3, WAV, M4A, WebM, or OGG).'
  }
  if (file.size > MAX_BYTES) {
    return 'File is too large (max 52MB).'
  }
  return null
}

export async function uploadMusicTrack (input: {
  projectId: string
  title: string
  notes?: string
  file: File
  token: string
}): Promise<ProjectAsset> {
  const err = validateMusicTrackFile(input.file)
  if (err) throw new Error(err)

  const fd = new FormData()
  fd.append('file', input.file)
  fd.append('kind', 'other')
  fd.append('title', input.title.trim().slice(0, 500) || 'Music track')
  fd.append('notes', (input.notes || '').slice(0, 20_000))
  fd.append(
    'metadata',
    JSON.stringify({
      source: 'music_upload'
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
