import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import type { ProjectAsset } from '~/types/project-asset'

export async function uploadCharacterPortrait (input: {
  projectId: string
  characterId: string
  characterName: string
  roleDescription?: string
  file: File
  token: string
}): Promise<ProjectAsset> {
  if (!input.file.type.startsWith('image/')) {
    throw new Error('Choose an image file (JPEG, PNG, WebP, or GIF).')
  }

  const uploadFile = await prepareImageFileForUpload(input.file)
  const fd = new FormData()
  fd.append('file', uploadFile)
  fd.append('kind', 'character')
  fd.append(
    'title',
    `${input.characterName.trim() || 'Character'} — portrait`.slice(0, 500)
  )
  fd.append('notes', (input.roleDescription || '').slice(0, 20_000))
  fd.append(
    'metadata',
    JSON.stringify({
      source: 'character_upload',
      character_name: input.characterName.trim(),
      character_id: input.characterId,
      featured: true
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
