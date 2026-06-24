import type { ProjectAsset } from '~/types/project-asset'

const ACCEPTED_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'video/mp4'
])

const MAX_BYTES = 25 * 1024 * 1024

export function validateCharacterVoiceSampleFile (file: File): string | null {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  const extOk = /\.(mp3|wav|m4a|webm|ogg|mp4)$/i.test(name)
  if (!ACCEPTED_TYPES.has(type) && !extOk) {
    return 'Choose an audio file (MP3, WAV, M4A, WebM, or OGG).'
  }
  if (file.size > MAX_BYTES) {
    return 'File is too large (max 25MB). Use a shorter clip (~10 seconds).'
  }
  return null
}

export async function uploadCharacterVoiceSample (input: {
  projectId: string
  characterId: string
  characterName: string
  file: File
  token: string
}): Promise<ProjectAsset> {
  const err = validateCharacterVoiceSampleFile(input.file)
  if (err) throw new Error(err)

  const fd = new FormData()
  fd.append('file', input.file)
  fd.append('kind', 'character')
  fd.append(
    'title',
    `${input.characterName.trim() || 'Character'} — voice sample`.slice(0, 500)
  )
  fd.append(
    'metadata',
    JSON.stringify({
      source: 'character_voice_sample',
      character_name: input.characterName.trim(),
      character_id: input.characterId
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
