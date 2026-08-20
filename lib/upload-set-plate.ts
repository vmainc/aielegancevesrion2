import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { setLockMetadata } from '~/lib/set-lock'
import type { ProjectAsset } from '~/types/project-asset'

export async function uploadSetPlate (input: {
  projectId: string
  entityId: string
  locationName: string
  file: File
  token: string
}): Promise<ProjectAsset> {
  if (!input.file.type.startsWith('image/')) {
    throw new Error('Choose an image file (JPEG, PNG, WebP, or GIF).')
  }

  const uploadFile = await prepareImageFileForUpload(input.file)
  const fd = new FormData()
  fd.append('file', uploadFile)
  fd.append('kind', 'other')
  fd.append(
    'title',
    `${input.locationName.trim() || 'Set'} — establishing plate`.slice(0, 500)
  )
  fd.append(
    'notes',
    'Locked set plate: match this place (architecture, materials, layout). Do not copy this camera.'
  )
  fd.append('metadata', JSON.stringify(setLockMetadata(input.entityId, true)))

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
