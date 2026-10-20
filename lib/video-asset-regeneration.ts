import { readGenerationObservability } from '~/lib/generation-observability'
import type { VideoGenerationPrefill } from '~/lib/video-generation-prefill'
import type { ProjectAsset } from '~/types/project-asset'

const GENERIC_SOURCE_NOTES = new Set([
  'Generated from Video tools (standalone).',
  'Generated from project Storyboard via Video tools.',
  'Generated from project Video step via Video tools.'
])

/** Stable media URLs we can re-attach on Edit (project media or remote https). */
export function isDurableVideoFrameUrl (url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (u.startsWith('data:') || u.startsWith('blob:')) return false
  // Ephemeral staged seeds expire — only durable after ingest to project assets.
  if (u.includes('/api/generate/video/start-frame/')) return false
  if (/^\/api\/projects\/[^/]+\/assets\/[^/]+\/media/.test(u.split('?')[0] || '')) return true
  return /^https?:\/\//i.test(u)
}

/** Strip playback tokens so stored frame URLs stay reusable. */
export function stripPlaybackAccessToken (url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  try {
    if (raw.startsWith('/')) {
      const u = new URL(raw, 'https://local.invalid')
      u.searchParams.delete('access_token')
      return `${u.pathname}${u.search}${u.hash}`
    }
    const u = new URL(raw)
    u.searchParams.delete('access_token')
    return u.toString()
  } catch {
    return raw.replace(/([?&])access_token=[^&]*/g, '$1').replace(/[?&]$/, '')
  }
}

export type VideoDialogueTurnMeta = {
  speaker_id?: string
  speaker_name?: string
  line: string
  tone?: string
}

export type VideoRegenerationSnapshotFields = {
  regeneration_prompt: string
  character_ids?: string[]
  start_frame_url?: string
  end_frame_url?: string
  location_id?: string
  location_name?: string
  negative_prompt?: string
  dialogue_turns?: VideoDialogueTurnMeta[]
  ambient_sound_prompt?: string
  include_spoken_dialogue?: boolean
  include_ambient_sound?: boolean
  aspect_ratio?: string
  duration_seconds?: number
  resolution?: string
  model_id?: string
}

function metaRecord (asset: ProjectAsset): Record<string, unknown> {
  return asset.metadata && typeof asset.metadata === 'object'
    ? (asset.metadata as Record<string, unknown>)
    : {}
}

function readString (meta: Record<string, unknown>, key: string): string {
  const v = meta[key]
  return typeof v === 'string' ? v.trim() : ''
}

function readStringArray (meta: Record<string, unknown>, key: string): string[] {
  const v = meta[key]
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}

function readDialogueTurns (meta: Record<string, unknown>): VideoDialogueTurnMeta[] {
  const raw = meta.dialogue_turns
  if (!Array.isArray(raw)) return []
  const out: VideoDialogueTurnMeta[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const line = typeof o.line === 'string' ? o.line.trim() : ''
    if (!line) continue
    out.push({
      line: line.slice(0, 500),
      speaker_id: typeof o.speaker_id === 'string' ? o.speaker_id.trim() : undefined,
      speaker_name: typeof o.speaker_name === 'string' ? o.speaker_name.trim().slice(0, 200) : undefined,
      tone: typeof o.tone === 'string' ? o.tone.trim().slice(0, 80) : undefined
    })
  }
  return out
}

/** Prefer stored regeneration prompt; fall back to notes / truncated title for older clips. */
export function resolveVideoAssetPrompt (asset: ProjectAsset): {
  prompt: string
  truncated: boolean
} {
  const meta = metaRecord(asset)
  const fromMeta = readString(meta, 'regeneration_prompt')
  if (fromMeta) return { prompt: fromMeta, truncated: false }

  const notes = (asset.notes || '').trim()
  if (notes && !GENERIC_SOURCE_NOTES.has(notes)) {
    return { prompt: notes, truncated: false }
  }

  const title = (asset.title || '').trim()
  const withoutSuffix = title.replace(/\s*—\s*video\s*$/i, '').trim()
  if (withoutSuffix) {
    return { prompt: withoutSuffix, truncated: withoutSuffix.length >= 75 }
  }
  return { prompt: '', truncated: false }
}

export function videoAssetToGenerationPrefill (
  asset: ProjectAsset,
  projectId: string
): VideoGenerationPrefill {
  const meta = metaRecord(asset)
  const { prompt, truncated } = resolveVideoAssetPrompt(asset)
  const obs = readGenerationObservability(meta)
  const characterIds =
    readStringArray(meta, 'character_ids').length
      ? readStringArray(meta, 'character_ids')
      : (obs?.characterIds || []).filter(Boolean)

  const aspectRaw = readString(meta, 'aspect_ratio')
  const aspectRatio =
    aspectRaw === '16:9' || aspectRaw === '9:16' || aspectRaw === '1:1'
      ? aspectRaw
      : undefined

  const durationRaw = meta.duration_seconds
  const durationSeconds =
    typeof durationRaw === 'number' && Number.isFinite(durationRaw)
      ? Math.round(durationRaw)
      : undefined

  const startFrame = readString(meta, 'start_frame_url')
  const endFrame = readString(meta, 'end_frame_url')
  const dialogueTurns = readDialogueTurns(meta)
  const negative = readString(meta, 'negative_prompt')
  const locationId = readString(meta, 'location_id')
  const ambient = readString(meta, 'ambient_sound_prompt')
  const sceneId = readString(meta, 'scene_id') || asset.sceneId || ''
  const shotId = readString(meta, 'shot_id') || asset.shotId || ''
  const modelId = readString(meta, 'model_id')
  const resolution = readString(meta, 'resolution')

  return {
    prompt: prompt || ' ',
    projectId,
    saveToProject: true,
    source: 'project_generated_videos_edit',
    replaceAssetId: asset.id,
    shotTitle: (asset.title || '').replace(/\s*—\s*video\s*$/i, '').trim().slice(0, 120) || undefined,
    sceneId: sceneId || undefined,
    shotId: shotId || undefined,
    characterIds: characterIds.length ? characterIds : undefined,
    locationId: locationId || undefined,
    negativePrompt: negative || undefined,
    startFrameUrl: startFrame && isDurableVideoFrameUrl(startFrame) ? startFrame : null,
    endFrameUrl: endFrame && isDurableVideoFrameUrl(endFrame) ? endFrame : null,
    aspectRatio,
    durationSeconds,
    modelId: modelId || undefined,
    resolution: resolution || undefined,
    includeSpokenDialogue: meta.include_spoken_dialogue === true || dialogueTurns.length > 0,
    includeAmbientSound: meta.include_ambient_sound === true || Boolean(ambient),
    ambientSoundPrompt: ambient || undefined,
    dialogueTurns: dialogueTurns.length
      ? dialogueTurns.map((t) => ({
          speakerId: t.speaker_id || '',
          speakerName: t.speaker_name || '',
          line: t.line,
          tone: t.tone || 'neutral'
        }))
      : undefined,
    promptMayBeTruncated: truncated
  }
}

/** Fields to stamp on new video assets so Edit can restore the full form. */
export function buildVideoRegenerationMetadata (args: {
  userPrompt: string
  characterIds?: string[]
  startFrameUrl?: string | null
  endFrameUrl?: string | null
  locationId?: string
  locationName?: string
  negativePrompt?: string
  dialogueTurns?: VideoDialogueTurnMeta[]
  ambientSoundPrompt?: string
  includeSpokenDialogue?: boolean
  includeAmbientSound?: boolean
  aspectRatio?: string
  durationSeconds?: number
  resolution?: string
  modelId?: string
}): Partial<VideoRegenerationSnapshotFields> {
  const prompt = args.userPrompt.trim().slice(0, 20_000)
  const start = args.startFrameUrl ? stripPlaybackAccessToken(args.startFrameUrl) : ''
  const end = args.endFrameUrl ? stripPlaybackAccessToken(args.endFrameUrl) : ''
  return {
    regeneration_prompt: prompt,
    ...(args.characterIds?.length ? { character_ids: args.characterIds } : {}),
    ...(start && isDurableVideoFrameUrl(start) ? { start_frame_url: start.slice(0, 2000) } : {}),
    ...(end && isDurableVideoFrameUrl(end) ? { end_frame_url: end.slice(0, 2000) } : {}),
    ...(args.locationId ? { location_id: args.locationId, location_name: (args.locationName || '').slice(0, 200) } : {}),
    ...(args.negativePrompt?.trim()
      ? { negative_prompt: args.negativePrompt.trim().slice(0, 4000) }
      : {}),
    ...(args.dialogueTurns?.length ? { dialogue_turns: args.dialogueTurns } : {}),
    ...(args.ambientSoundPrompt?.trim()
      ? { ambient_sound_prompt: args.ambientSoundPrompt.trim() }
      : {}),
    ...(args.includeSpokenDialogue ? { include_spoken_dialogue: true } : {}),
    ...(args.includeAmbientSound ? { include_ambient_sound: true } : {}),
    ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
    ...(typeof args.durationSeconds === 'number' ? { duration_seconds: args.durationSeconds } : {}),
    ...(args.resolution ? { resolution: args.resolution } : {}),
    ...(args.modelId ? { model_id: args.modelId } : {})
  }
}

/** Notes field stores the user prompt so the Generated Videos list shows it. */
export function videoAssetNotesFromPrompt (userPrompt: string): string {
  return userPrompt.trim().slice(0, 10_000)
}

export function isVideoEditPrefill (
  p: VideoGenerationPrefill | null | undefined
): boolean {
  return Boolean(p?.replaceAssetId?.trim())
}
