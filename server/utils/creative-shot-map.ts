import type { CreativeShot } from '~/types/creative-shot'

type PbShotRecord = {
  id: string
  project: string | { id?: string }
  scene: string | { id?: string }
  sort_order: number
  title: string
  description?: string
  shot_type?: string
  camera_move?: string
  duration_seconds?: number
  image_prompt?: string
  video_prompt?: string
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
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    title: r.title || '',
    description: r.description || '',
    shotType: r.shot_type || '',
    cameraMove: r.camera_move || '',
    durationSeconds: typeof r.duration_seconds === 'number' ? r.duration_seconds : 0,
    imagePrompt: r.image_prompt || '',
    videoPrompt: r.video_prompt || ''
  }
}
