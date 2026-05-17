import type { CreativeShot } from '~/types/creative-shot'

type PbShotRecord = {
  id: string
  project: string | { id?: string }
  scene: string | { id?: string }
  sort_order?: number
  sortOrder?: number
  title: string
  description?: string
  shot_type?: string
  camera_move?: string
  duration_seconds?: number
  image_prompt?: string
  video_prompt?: string
  negative_prompt?: string
  imagePrompt?: string
  videoPrompt?: string
  negativePrompt?: string
  shotType?: string
  cameraMove?: string
  durationSeconds?: number
}

function relId (v: string | { id?: string } | undefined): string {
  if (!v) return ''
  return typeof v === 'string' ? v : (v.id || '')
}

export function pbRecordToCreativeShot (r: PbShotRecord): CreativeShot {
  return {
    id: r.id,
    projectId: relId(r.project),
    sceneId: relId(r.scene),
    sortOrder:
      typeof r.sort_order === 'number'
        ? r.sort_order
        : typeof r.sortOrder === 'number'
          ? r.sortOrder
          : 0,
    title: r.title || '',
    description: r.description || '',
    shotType: r.shot_type || r.shotType || '',
    cameraMove: r.camera_move || r.cameraMove || '',
    durationSeconds:
      typeof r.duration_seconds === 'number'
        ? r.duration_seconds
        : typeof r.durationSeconds === 'number'
          ? r.durationSeconds
          : 0,
    imagePrompt: r.image_prompt || r.imagePrompt || '',
    videoPrompt: r.video_prompt || r.videoPrompt || '',
    negativePrompt: r.negative_prompt || r.negativePrompt || ''
  }
}
