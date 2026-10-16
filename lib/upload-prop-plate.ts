import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { propPlateMetadata } from '~/lib/prop-lock'
import type { ProjectAsset } from '~/types/project-asset'

export async function uploadPropPlate (input: {
  projectId: string
  entityId: string
  propName: string
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
    `${input.propName.trim() || 'Prop'} — object plate`.slice(0, 500)
  )
  fd.append(
    'notes',
    'Locked prop plate: match this object (shape, materials, color, condition). Do not copy this angle.'
  )
  fd.append('metadata', JSON.stringify(propPlateMetadata(input.entityId, true)))

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
