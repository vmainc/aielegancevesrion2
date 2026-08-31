<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-8">
      <p class="text-[11px] font-semibold uppercase tracking-cinema text-primary mb-2">Post</p>
      <h1 class="font-display text-4xl sm:text-5xl text-ivory tracking-wide">Fix Shot</h1>
      <p class="mt-2 text-base text-gray-700 max-w-2xl">
        Keep the shot. Fix what went wrong.
      </p>
    </header>

    <p
      v-if="authReady && !isAuthenticated"
      class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6"
    >
      <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
      to repair a clip.
    </p>

    <!-- Repairing -->
    <div
      v-if="phase === 'repairing'"
      class="rounded-xl border border-primary/25 bg-primary/5 px-6 py-14 mb-10"
    >
      <FilmReelLoader
        size="lg"
        label="Repairing shot"
        :sub-label="jobStatusLabel"
      />
      <p class="mt-6 text-center text-sm text-gray-600 max-w-md mx-auto">
        The original clip is unchanged. You can refresh this page — the job will resume.
      </p>
    </div>

    <!-- Result -->
    <div v-else-if="phase === 'result'" class="space-y-6 mb-10">
      <div class="flex items-end justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl text-ivory tracking-wide">Original | Repaired</h2>
          <p class="text-sm text-gray-600 mt-1">Play both. Accept creates a new version — the original is never overwritten.</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section class="rounded-xl border border-gray-200 overflow-hidden bg-studio-slate">
          <div class="px-3 py-2 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Original
          </div>
          <div class="aspect-video bg-black">
            <video
              v-if="sourcePlayback"
              :src="playbackSrc(sourcePlayback)"
              class="w-full h-full object-contain"
              controls
              playsinline
            />
          </div>
        </section>
        <section class="rounded-xl border border-primary/40 overflow-hidden bg-studio-slate">
          <div class="px-3 py-2 border-b border-primary/30 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Repaired
          </div>
          <div class="aspect-video bg-black">
            <video
              v-if="repairedPlayback"
              :src="playbackSrc(repairedPlayback)"
              class="w-full h-full object-contain"
              controls
              playsinline
            />
          </div>
        </section>
      </div>
      <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="projectId"
          type="button"
          class="px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90 disabled:opacity-45"
          :disabled="accepting"
          @click="acceptRepair(true)"
        >
          {{ accepting ? 'Saving…' : 'Accept repair' }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50"
          @click="tryAgain"
        >
          Try again
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50"
          @click="adjustInstructions"
        >
          Adjust instructions
        </button>
        <button
          v-if="projectId"
          type="button"
          class="px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50 disabled:opacity-45"
          :disabled="accepting"
          @click="acceptRepair(false)"
        >
          Keep both
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50"
          @click="downloadRepaired"
        >
          Download
        </button>
      </div>
      <p v-if="savedNote" class="text-sm text-primary">{{ savedNote }}</p>
    </div>

    <!-- Form -->
    <div v-else class="space-y-8">
      <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
        <h2 class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">Source video</h2>
        <div v-if="libraryClips.length" class="space-y-2">
          <label class="block text-sm text-gray-700">Existing clip</label>
          <select
            v-model="sourceAssetId"
            class="w-full max-w-xl px-3 py-2 rounded-lg bg-charcoal border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
            @change="onPickLibraryClip"
          >
            <option value="">Select a generated clip…</option>
            <option v-for="c in libraryClips" :key="c.id" :value="c.id">
              {{ c.title }}
            </option>
          </select>
        </div>
        <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:border-primary/50 cursor-pointer">
          Upload a video
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            class="sr-only"
            @change="onUploadSource"
          >
        </label>
        <p v-if="uploadHint" class="text-xs text-gray-500">{{ uploadHint }}</p>
        <p v-if="sourceModelLabel" class="text-xs text-gray-500">
          Original generated with <span class="text-primary font-medium">{{ sourceModelLabel }}</span>
          — repair will try to match that look.
        </p>
        <div v-if="sourcePlayback" class="rounded-lg overflow-hidden border border-gray-200 bg-black">
          <video
            :src="playbackSrc(sourcePlayback)"
            class="w-full max-h-[28rem] object-contain"
            controls
            playsinline
            @loadedmetadata="onSourceMeta"
          />
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
        <h2 class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">What went wrong?</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors"
            :class="selected.includes(cat.id)
              ? 'bg-primary text-gray-950 border-primary'
              : 'border-gray-300 text-gray-700 hover:border-primary/50'"
            @click="toggleCategory(cat.id)"
          >
            {{ cat.label }}
          </button>
        </div>
        <p v-if="voiceOnly" class="text-sm text-amber-200 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2">
          Voice repair is handled separately from visual repair.
        </p>
        <div>
          <label for="repair-desc" class="block text-sm font-medium text-gray-700 mb-2">Describe what needs fixing</label>
          <textarea
            id="repair-desc"
            v-model="description"
            rows="4"
            :placeholder="exampleDesc"
            class="w-full px-3 py-2 rounded-lg bg-charcoal border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          />
        </div>
      </section>

      <section v-if="sourcePlayback" class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
        <FixShotReferenceFrameScrubber
          :src="playbackSrc(sourcePlayback)"
          :busy="frameBusy"
          @extract="onExtractFrame"
          @upload="onUploadReference"
        />
        <div v-if="referencePreview" class="flex items-center gap-3">
          <img :src="referencePreview" alt="Reference" class="w-24 h-16 object-cover rounded border border-primary/40">
          <p class="text-sm text-gray-600">
            Reference locked
            <span v-if="referenceTimecode" class="font-mono text-primary">{{ referenceTimecode }}</span>
          </p>
        </div>
        <button
          v-if="characterPortraitUrl"
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50"
          @click="useCharacterReference"
        >
          Use character reference
        </button>
      </section>

      <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
        <h2 class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">Repair strength</h2>
        <div class="grid sm:grid-cols-3 gap-3">
          <button
            v-for="mode in modes"
            :key="mode.id"
            type="button"
            class="text-left rounded-xl border px-4 py-3 transition-colors"
            :class="repairMode === mode.id
              ? 'border-primary bg-primary/10'
              : 'border-gray-200 hover:border-primary/40'"
            @click="repairMode = mode.id"
          >
            <p class="text-sm font-semibold text-gray-900 uppercase tracking-wide">{{ mode.label }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ mode.hint }}</p>
          </button>
        </div>
        <details class="pt-2">
          <summary class="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer">
            Advanced · Repair engine
          </summary>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="eng in engines"
              :key="eng.id"
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg border"
              :class="engine === eng.id
                ? 'bg-primary text-gray-950 border-primary'
                : 'border-gray-300 text-gray-700'"
              :disabled="eng.id === 'luma' && !lumaConfigured"
              @click="engine = eng.id"
            >
              {{ eng.label }}
            </button>
          </div>
          <p v-if="!lumaConfigured" class="mt-2 text-[11px] text-gray-500">
            Luma Modify appears when LUMA_API_KEY is set on the server.
          </p>
        </details>
      </section>

      <section class="rounded-xl border border-dashed border-gray-300 bg-gray-50/40 p-5 sm:p-6 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">Analyze shot</h2>
            <p class="text-xs text-gray-500 mt-1">Experimental — sampled frames, not a full computer-vision pass.</p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50 disabled:opacity-40"
            :disabled="analyzing || !sourcePlayback"
            @click="runAnalyze"
          >
            {{ analyzing ? 'Analyzing…' : 'Analyze shot' }}
          </button>
        </div>
        <p v-if="analyzeSummary" class="text-sm text-gray-700">{{ analyzeSummary }}</p>
        <ul v-if="findings.length" class="space-y-2">
          <li
            v-for="(f, i) in findings"
            :key="i"
            class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
          >
            <div>
              <p class="text-sm text-gray-900">{{ f.description }}</p>
              <p class="text-[11px] text-gray-500 mt-0.5">
                {{ f.type.replace(/_/g, ' ') }} · {{ f.severity }}
                <span v-if="f.startTime || f.endTime"> · {{ f.startTime }}s–{{ f.endTime }}s</span>
              </p>
            </div>
            <button
              v-if="f.repairCategory"
              type="button"
              class="shrink-0 px-2 py-1 text-[10px] font-bold uppercase rounded bg-primary text-gray-950"
              @click="applyFinding(f)"
            >
              Fix
            </button>
          </li>
        </ul>
      </section>

      <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
      <button
        type="button"
        class="px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-gray-950 font-semibold disabled:opacity-45"
        :disabled="!canSubmit"
        @click="submitRepair"
      >
        Fix shot
      </button>

      <section v-if="versions.length" class="rounded-xl border border-gray-200 bg-studio-slate p-5 space-y-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-cinema text-gray-500">Version history</h2>
        <ul class="space-y-1">
          <li
            v-for="v in versions"
            :key="v.assetId"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <span :class="v.isCurrent ? 'text-primary font-semibold' : 'text-gray-700'">
              v{{ v.version }} {{ v.label }}
            </span>
            <button
              v-if="!v.isCurrent"
              type="button"
              class="text-xs font-semibold text-primary hover:underline"
              @click="revertTo(v.assetId)"
            >
              Revert
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { downloadMediaFile } from '~/lib/download-media-file'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { appendPlaybackAccessToken, projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import {
  REPAIR_CATEGORIES,
  REPAIR_ENGINE_LABELS,
  REPAIR_MODE_LABELS,
  defaultRepairDescriptionExample,
  formatSourceGenerationModelLabel,
  formatTimecode,
  hasVoiceOnlyRepair,
  readAssetSourceGenerationModel,
  visualRepairCategories,
  type RepairCategoryId,
  type RepairEngineChoice,
  type RepairMode,
  type ShotAnalysisFinding,
  type ShotVideoVersion
} from '~/lib/video-repair'
import type { ProjectAsset } from '~/types/project-asset'
import type { CreativeShot } from '~/types/creative-shot'
import { findCharactersInShot } from '~/lib/shot-character-continuity'
import { useProjectCharacterRefs } from '~/composables/useProjectCharacterRefs'

useHead({ title: 'Fix Shot' })

const JOB_STORAGE = 'aie_fix_shot_active_job'
const { isAuthenticated, authReady, getAuthToken } = useAuth()
const route = useRoute()
const toast = useToast()

const projectId = computed(() => String(route.query.projectId || '').trim())
const sceneId = computed(() => String(route.query.sceneId || '').trim())
const shotId = computed(() => String(route.query.shotId || '').trim())
const queryAssetId = computed(() => String(route.query.assetId || '').trim())

const categories = REPAIR_CATEGORIES
const modes = (Object.keys(REPAIR_MODE_LABELS) as RepairMode[]).map(id => ({ id, ...REPAIR_MODE_LABELS[id] }))
const engines = (Object.keys(REPAIR_ENGINE_LABELS) as RepairEngineChoice[]).map(id => ({
  id,
  label: REPAIR_ENGINE_LABELS[id]
}))
const exampleDesc = defaultRepairDescriptionExample()

const selected = ref<RepairCategoryId[]>([])
const description = ref('')
const repairMode = ref<RepairMode>('balanced')
const engine = ref<RepairEngineChoice>('auto')
const lumaConfigured = ref(false)
const maxDuration = ref(30)
const maxUploadMb = ref(150)

const libraryClips = ref<ProjectAsset[]>([])
const sourceAssetId = ref('')
const sourceMediaId = ref('')
const sourcePlayback = ref('')
const sourceDuration = ref<number | null>(null)
const sourceGenerationModel = ref('')
const uploadHint = ref('')
const sourceModelLabel = computed(() => formatSourceGenerationModelLabel(sourceGenerationModel.value))

const referenceMediaId = ref('')
const referencePreview = ref('')
const referenceTimecode = ref('')
const referenceTimestamp = ref<number | null>(null)
const frameBusy = ref(false)
const characterPortraitUrl = ref('')
const characterName = ref('')
const characterAppearance = ref('')

const phase = ref<'form' | 'repairing' | 'result'>('form')
const jobId = ref('')
const jobStatus = ref('')
const repairedPlayback = ref('')
const formError = ref('')
const actionError = ref('')
const accepting = ref(false)
const savedNote = ref('')
const analyzing = ref(false)
const analyzeSummary = ref('')
const findings = ref<ShotAnalysisFinding[]>([])
const versions = ref<ShotVideoVersion[]>([])

const voiceOnly = computed(() => hasVoiceOnlyRepair(selected.value))
const canSubmit = computed(() => {
  if (!isAuthenticated.value) return false
  if (!sourcePlayback.value) return false
  if (!visualRepairCategories(selected.value).length) return false
  if (!description.value.trim()) return false
  if (voiceOnly.value) return false
  return true
})
const jobStatusLabel = computed(() => {
  const s = jobStatus.value
  if (s === 'in_progress') return 'The model is working…'
  if (s === 'pending' || s === 'queued') return 'Queued with the repair engine…'
  return 'Submitting repair job…'
})

const { refs: characterRefs, reload: loadCharacters } = useProjectCharacterRefs(projectId)

function playbackSrc (url: string): string {
  return appendPlaybackAccessToken(url, getAuthToken())
}

function authHeaders (): Record<string, string> {
  return pocketBaseBearerHeaders(getAuthToken())
}

function toggleCategory (id: RepairCategoryId) {
  const cur = selected.value
  selected.value = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
}

function persistJobId (id: string) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(JOB_STORAGE, id)
  } catch { /* ignore */ }
}

function clearPersistedJob () {
  if (!import.meta.client) return
  try {
    localStorage.removeItem(JOB_STORAGE)
  } catch { /* ignore */ }
}

async function loadConfig () {
  try {
    const cfg = await $fetch<{
      limits: { maxDurationSeconds: number; maxUploadMb: number }
      engines: { lumaConfigured: boolean }
    }>('/api/repair/config', { headers: authHeaders() })
    maxDuration.value = cfg.limits.maxDurationSeconds
    maxUploadMb.value = cfg.limits.maxUploadMb
    lumaConfigured.value = cfg.engines.lumaConfigured
  } catch {
    /* defaults */
  }
}

async function loadLibrary () {
  const pid = projectId.value
  if (!pid || !isAuthenticated.value) return
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(`/api/projects/${pid}/assets`, {
      query: { kind: 'video' },
      headers: authHeaders()
    })
    const items = res.items || []
    libraryClips.value = shotId.value
      ? items.filter(a => (a.shotId || String(a.metadata?.shot_id || '')) === shotId.value)
      : items
    if (queryAssetId.value) {
      sourceAssetId.value = queryAssetId.value
      onPickLibraryClip()
    } else if (libraryClips.value.length === 1) {
      sourceAssetId.value = libraryClips.value[0]!.id
      onPickLibraryClip()
    }
  } catch (e: unknown) {
    console.warn('[fix-shot] library load', e)
  }
}

async function loadVersions () {
  const pid = projectId.value
  const sid = shotId.value
  if (!pid || !sid) return
  try {
    const res = await $fetch<{ versions: ShotVideoVersion[] }>(
      `/api/projects/${pid}/shots/${sid}/versions`,
      { headers: authHeaders() }
    )
    versions.value = res.versions || []
  } catch {
    versions.value = []
  }
}

function onPickLibraryClip () {
  const clip = libraryClips.value.find(c => c.id === sourceAssetId.value)
  if (!clip) return
  sourceMediaId.value = ''
  sourcePlayback.value = projectAssetPlaybackSrc(clip, getAuthToken())
  sourceDuration.value = typeof clip.metadata?.duration_seconds === 'number'
    ? Number(clip.metadata.duration_seconds)
    : null
  sourceGenerationModel.value = readAssetSourceGenerationModel(clip.metadata)
}

function onSourceMeta (e: Event) {
  const v = e.target as HTMLVideoElement
  if (Number.isFinite(v.duration)) sourceDuration.value = v.duration
}

async function onUploadSource (e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  formError.value = ''
  uploadHint.value = `Uploading ${file.name}…`
  try {
    const fd = new FormData()
    fd.append('file', file)
    if (sourceDuration.value) fd.append('durationSeconds', String(sourceDuration.value))
    const res = await $fetch<{ mediaId: string; playbackUrl: string; durationSeconds: number | null }>(
      '/api/repair/video/upload',
      { method: 'POST', headers: authHeaders(), body: fd }
    )
    sourceAssetId.value = ''
    sourceMediaId.value = res.mediaId
    sourcePlayback.value = res.playbackUrl
    sourceDuration.value = res.durationSeconds
    sourceGenerationModel.value = ''
    uploadHint.value = ''
  } catch (err: unknown) {
    uploadHint.value = ''
    formError.value = formatApiFetchError(err, 'Could not upload that video.')
  }
}

async function uploadFrameBlob (blob: Blob, timestamp?: number) {
  frameBusy.value = true
  try {
    const fd = new FormData()
    fd.append('file', blob, 'frame.jpg')
    if (timestamp != null) fd.append('timestampSeconds', String(timestamp))
    const res = await $fetch<{ mediaId: string; playbackUrl: string; timestampSeconds: number | null }>(
      '/api/repair/video/extract-frame',
      { method: 'POST', headers: authHeaders(), body: fd }
    )
    referenceMediaId.value = res.mediaId
    referencePreview.value = playbackSrc(res.playbackUrl)
    if (timestamp != null) {
      referenceTimestamp.value = timestamp
      referenceTimecode.value = formatTimecode(timestamp)
    }
  } finally {
    frameBusy.value = false
  }
}

async function onExtractFrame (blob: Blob, timestampSeconds: number) {
  await uploadFrameBlob(blob, timestampSeconds)
}

async function onUploadReference (file: File) {
  await uploadFrameBlob(file)
}

async function useCharacterReference () {
  if (!characterPortraitUrl.value) return
  frameBusy.value = true
  try {
    const res = await fetch(playbackSrc(characterPortraitUrl.value), { headers: authHeaders() })
    if (!res.ok) throw new Error('Could not load character reference')
    const blob = await res.blob()
    await uploadFrameBlob(blob)
  } catch (e: unknown) {
    formError.value = formatApiFetchError(e, 'Could not use the character reference.')
  } finally {
    frameBusy.value = false
  }
}

function onSourceCharacters () {
  const shot: CreativeShot = {
    id: shotId.value,
    projectId: projectId.value,
    sceneId: sceneId.value,
    sortOrder: 0,
    title: '',
    description: '',
    shotType: '',
    cameraMove: '',
    durationSeconds: 5,
    imagePrompt: '',
    videoPrompt: '',
    negativePrompt: ''
  }
  const hits = findCharactersInShot(shot, characterRefs.value)
  const c = hits[0] || characterRefs.value[0]
  if (!c) return
  characterName.value = c.name
  characterAppearance.value = c.appearanceDescription || c.roleDescription || ''
  characterPortraitUrl.value = c.portraitUrl || ''
}

async function submitRepair () {
  formError.value = ''
  try {
    const res = await $fetch<{
      id: string
      status: string
      async?: boolean
      sourceVideo?: string
      outputVideo?: string | null
    }>('/api/repair/video', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        categories: [...selected.value],
        description: description.value,
        repairMode: repairMode.value,
        engine: engine.value,
        projectId: projectId.value || undefined,
        sceneId: sceneId.value || undefined,
        shotId: shotId.value || undefined,
        sourceAssetId: sourceAssetId.value || undefined,
        sourceMediaId: sourceMediaId.value || undefined,
        sourceGenerationModel: sourceGenerationModel.value || undefined,
        durationSeconds: sourceDuration.value,
        referenceMediaId: referenceMediaId.value || undefined,
        referenceImageUrl: !referenceMediaId.value && characterPortraitUrl.value === referencePreview.value
          ? characterPortraitUrl.value
          : undefined,
        referenceTimestampSeconds: referenceTimestamp.value,
        characterName: characterName.value,
        characterAppearance: characterAppearance.value
      }
    })
    jobId.value = res.id
    persistJobId(res.id)
    sourcePlayback.value = res.sourceVideo || sourcePlayback.value
    if (res.status === 'completed' && res.outputVideo) {
      repairedPlayback.value = res.outputVideo
      phase.value = 'result'
      clearPersistedJob()
      return
    }
    phase.value = 'repairing'
    jobStatus.value = res.status || 'pending'
    await pollUntilDone(res.id)
  } catch (e: unknown) {
    formError.value = formatApiFetchError(e, 'Could not start the repair.')
  }
}

async function pollUntilDone (id: string) {
  const deadline = Date.now() + 22 * 60 * 1000
  let wait = 2200
  while (Date.now() < deadline) {
    const s = await $fetch<{
      id: string
      status: string
      outputVideo?: string | null
      error?: string | null
      sourceVideo?: string
    }>('/api/repair/video/status', { query: { jobId: id }, headers: authHeaders() })
    jobStatus.value = s.status
    if (s.sourceVideo) sourcePlayback.value = s.sourceVideo
    if (s.status === 'completed' && s.outputVideo) {
      repairedPlayback.value = s.outputVideo
      phase.value = 'result'
      clearPersistedJob()
      return
    }
    if (s.status === 'failed' || s.status === 'cancelled' || s.status === 'expired') {
      phase.value = 'form'
      formError.value = (s.error || '').trim() || 'Repair failed. Adjust instructions and try again.'
      clearPersistedJob()
      return
    }
    await new Promise(r => setTimeout(r, wait))
    wait = Math.min(12_000, Math.floor(wait * 1.2))
  }
  formError.value = 'Still repairing — refresh this page to check progress.'
}

async function resumeJob (id: string) {
  jobId.value = id
  phase.value = 'repairing'
  try {
    await pollUntilDone(id)
  } catch (e: unknown) {
    phase.value = 'form'
    formError.value = formatApiFetchError(e, 'Could not resume the repair.')
    clearPersistedJob()
  }
}

function tryAgain () {
  phase.value = 'form'
  repairedPlayback.value = ''
  jobId.value = ''
  clearPersistedJob()
}

function adjustInstructions () {
  tryAgain()
}

async function acceptRepair (markCurrent: boolean) {
  if (!projectId.value || !jobId.value) return
  accepting.value = true
  actionError.value = ''
  savedNote.value = ''
  try {
    await $fetch('/api/repair/video/accept', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        jobId: jobId.value,
        projectId: projectId.value,
        sceneId: sceneId.value || undefined,
        shotId: shotId.value || undefined,
        sourceAssetId: sourceAssetId.value || undefined,
        markCurrent
      }
    })
    savedNote.value = markCurrent
      ? 'Saved as a new shot version. The original clip is still in the library.'
      : 'Both clips are kept. The original remains current.'
    await loadVersions()
    toast.showToast(savedNote.value, 'success')
  } catch (e: unknown) {
    actionError.value = formatApiFetchError(e, 'Could not save the repaired clip.')
  } finally {
    accepting.value = false
  }
}

async function downloadRepaired () {
  if (!repairedPlayback.value) return
  try {
    await downloadMediaFile({
      url: playbackSrc(repairedPlayback.value),
      filename: 'fix-shot-repaired',
      headers: authHeaders()
    })
  } catch (e: unknown) {
    actionError.value = formatApiFetchError(e, 'Download failed.')
  }
}

async function runAnalyze () {
  analyzing.value = true
  analyzeSummary.value = ''
  findings.value = []
  try {
    const res = await $fetch<{ summary: string; findings: ShotAnalysisFinding[] }>('/api/repair/analyze', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: {
        frameMediaIds: referenceMediaId.value ? [referenceMediaId.value] : []
      }
    })
    analyzeSummary.value = res.summary
    findings.value = res.findings || []
  } catch (e: unknown) {
    analyzeSummary.value = formatApiFetchError(e, 'Analyze Shot could not run.')
  } finally {
    analyzing.value = false
  }
}

function applyFinding (f: ShotAnalysisFinding) {
  if (f.repairCategory && !selected.value.includes(f.repairCategory)) {
    selected.value = [...selected.value, f.repairCategory]
  }
  if (f.description && !description.value.trim()) description.value = f.description
}

async function revertTo (assetId: string) {
  const pid = projectId.value
  const sid = shotId.value
  if (!pid || !sid) return
  try {
    const res = await $fetch<{ versions: ShotVideoVersion[] }>(
      `/api/projects/${pid}/shots/${sid}/versions/current`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { assetId }
      }
    )
    versions.value = res.versions || []
    toast.showToast('Reverted to that version. The other files were not deleted.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not revert.'), 'error')
  }
}

onMounted(async () => {
  if (!isAuthenticated.value) return
  await loadConfig()
  await loadLibrary()
  await loadCharacters()
  onSourceCharacters()
  await loadVersions()
  const qJob = String(route.query.jobId || '').trim()
  let stored = ''
  try {
    stored = localStorage.getItem(JOB_STORAGE) || ''
  } catch { /* ignore */ }
  const resume = qJob || stored
  if (resume) await resumeJob(resume)
})
</script>
