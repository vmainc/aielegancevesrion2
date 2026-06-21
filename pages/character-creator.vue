<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Character Creator
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Design your characters with multiple AI models
      </p>
    </header>

    <form class="space-y-8 mb-10" @submit.prevent="runGenerate">
      <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Character
        </h2>
        <div>
          <label for="cc-name" class="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
          <input
            id="cc-name"
            v-model="name"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
            placeholder="Character name"
            autocomplete="off"
          >
        </div>
        <div>
          <div class="flex justify-between items-center gap-2 mb-1.5">
            <label for="cc-desc" class="text-sm font-medium text-gray-700">Description</label>
            <PromptEnhanceButton v-model="description" context="character" />
          </div>
          <textarea
            id="cc-desc"
            v-model="description"
            rows="4"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
            placeholder="Appearance only: species/type, age, build, face, fur or hair, colors, markings, and clothing — not story beats or scenes"
          />
        </div>
        <div>
          <label for="cc-style" class="block text-sm font-medium text-gray-700 mb-1.5">Style preset</label>
          <select
            id="cc-style"
            v-model="stylePreset"
            class="w-full sm:max-w-md px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
          >
            <option
              v-for="opt in CHARACTER_STYLE_PRESETS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="pt-2 border-t border-gray-200">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label for="cc-reference" class="text-sm font-medium text-gray-700">
              Reference / seed image <span class="font-normal text-gray-500">(optional)</span>
            </label>
            <button
              v-if="referenceImageUrl"
              type="button"
              class="text-xs font-medium text-gray-600 hover:text-red-700"
              @click="clearReferenceImage"
            >
              Remove
            </button>
          </div>
          <p class="text-xs text-gray-500 mb-3 max-w-2xl">
            Upload a photo or sketch, or use a portrait already saved for this character. Models will try to match this look while applying your description and style.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 items-start">
            <div
              v-if="referenceImageUrl"
              class="w-28 h-28 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0"
            >
              <img
                :src="referenceImageUrl"
                alt="Reference preview"
                class="w-full h-full object-cover"
              >
            </div>
            <div class="flex-1 min-w-0 space-y-2">
              <input
                id="cc-reference"
                ref="referenceFileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-gray-950 hover:file:bg-primary/90"
                @change="onReferenceFileSelected"
              >
              <p v-if="referenceLabel" class="text-xs text-gray-600">
                {{ referenceLabel }}
              </p>
              <button
                v-if="canLoadProjectPortrait && !referenceImageUrl"
                type="button"
                class="text-xs font-medium text-primary hover:underline"
                :disabled="loadingProjectPortrait"
                @click="loadPortraitFromProject"
              >
                {{ loadingProjectPortrait ? 'Loading…' : 'Use featured portrait from project' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
          Models
        </h2>
        <p class="text-xs text-gray-500 mb-4">Select one or more; generations run in parallel.</p>
        <div class="flex flex-wrap gap-3">
          <label
            v-for="m in CHARACTER_CREATOR_IMAGE_MODELS"
            :key="m.id"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              v-model="selectedModelIds"
              type="checkbox"
              :value="m.id"
              class="rounded border-gray-300 text-primary focus:ring-primary"
            >
            <span class="text-sm text-gray-800">{{ m.label }}</span>
          </label>
        </div>
      </section>

      <div v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {{ formError }}
      </div>

      <button
        type="submit"
        class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading || !selectedModelIds.length"
      >
        {{ loading ? `Generating characters… ${doneCount}/${selectedModelIds.length}` : 'Generate Character' }}
      </button>
    </form>

    <p v-if="loading && !hasAnySlot" class="text-sm text-gray-600 mb-6 animate-pulse">
      Generating characters…
    </p>

    <section v-if="hasAnySlot" class="space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Results</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <article
          v-for="m in CHARACTER_CREATOR_IMAGE_MODELS"
          v-show="selectedModelIds.includes(m.id) && slotByModel[m.id]"
          :key="m.id"
          class="rounded-xl overflow-hidden border border-gray-200 bg-white flex flex-col shadow-sm"
        >
          <div class="px-3 py-2.5 border-b border-gray-200 bg-gray-50">
            <span class="text-sm font-semibold text-gray-900">{{ m.label }}</span>
          </div>
          <div class="flex-1 min-h-[220px] flex items-center justify-center bg-gray-100">
            <template v-if="slotByModel[m.id]?.status === 'loading'">
              <div class="flex flex-col items-center gap-2 py-10 text-gray-600">
                <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span class="text-xs">Generating…</span>
              </div>
            </template>
            <template v-else-if="slotByModel[m.id]?.status === 'done' && imageSrc(slotByModel[m.id]!.url)">
              <img
                :src="imageSrc(slotByModel[m.id]!.url)"
                :alt="m.label"
                class="w-full h-auto object-cover max-h-[480px]"
              >
            </template>
            <template v-else-if="slotByModel[m.id]?.status === 'error'">
              <p class="text-red-700 text-sm px-4 py-6 text-center">
                {{ slotByModel[m.id]?.error || 'Failed' }}
              </p>
            </template>
          </div>
          <div
            v-if="slotByModel[m.id]?.status === 'done' && imageSrc(slotByModel[m.id]!.url)"
            class="p-3 border-t border-gray-200 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <button
              type="button"
              class="px-3 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-gray-950 rounded-lg transition-colors"
              @click="openSaveModal(m.id, m.label, imageSrc(slotByModel[m.id]!.url)!)"
            >
              Save to Library
            </button>
            <NuxtLink
              v-if="slotByModel[m.id]?.savedProjectId"
              :to="`/projects/${slotByModel[m.id]!.savedProjectId}/home`"
              class="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 rounded-lg transition-colors text-center"
            >
              Use in Project
            </NuxtLink>
            <NuxtLink
              v-else
              to="/projects"
              class="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-800 hover:bg-gray-50 rounded-lg transition-colors text-center"
            >
              Open projects
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="saveModalOpen"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-save-dialog-title"
        @click.self="closeSaveModal"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          @click.stop
        >
          <h2 id="cc-save-dialog-title" class="text-lg font-semibold text-gray-900 mb-2">
            Save to library
          </h2>
          <p class="text-sm text-gray-600 mb-4">
            Character images are stored per project in your account. You’ll see them under
            <NuxtLink to="/assets/characters" class="text-primary font-medium hover:underline">Assets → Characters</NuxtLink>
            and in the chosen project’s asset library.
          </p>

          <template v-if="!isAuthenticated">
            <p class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <NuxtLink to="/login" class="font-medium text-primary hover:underline">Sign in</NuxtLink>
              to save to your cloud library.
            </p>
            <button
              type="button"
              class="w-full px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 mb-2"
              @click="saveToDeviceOnly(); closeSaveModal()"
            >
              Save on this device only
            </button>
          </template>

          <template v-else-if="!pbProjects.length">
            <p class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Create or import a project first so we know where to attach this image.
            </p>
            <NuxtLink
              to="/projects"
              class="block w-full text-center px-4 py-2 text-sm font-semibold bg-primary text-gray-950 rounded-lg hover:bg-primary/90 mb-2"
              @click="closeSaveModal"
            >
              Go to Projects
            </NuxtLink>
          </template>

          <form v-else class="space-y-4" @submit.prevent="confirmCloudSave">
            <div>
              <label for="cc-save-project" class="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                id="cc-save-project"
                v-model="saveProjectId"
                required
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              >
                <option value="" disabled>Select project</option>
                <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label for="cc-save-asset-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                id="cc-save-asset-title"
                v-model="saveTitle"
                type="text"
                required
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              >
            </div>
            <p v-if="saveError" class="text-sm text-red-700">{{ saveError }}</p>
            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                :disabled="cloudSaving"
                @click="closeSaveModal"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                :disabled="cloudSaving"
                @click="saveToDeviceOnly(); closeSaveModal()"
              >
                This device only
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
                :disabled="cloudSaving || !saveProjectId"
              >
                {{ cloudSaving ? 'Saving…' : 'Save to account' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  CHARACTER_CREATOR_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID
} from '~/lib/character-creator-models'
import { buildCharacterImagePrompt, CHARACTER_STYLE_PRESETS } from '~/lib/character-image-prompt'
import { appendPlaybackAccessToken, projectAssetMediaPath } from '~/lib/project-asset-playback-url'
import type { CharacterLibraryEntry } from '~/types/character-creator'
import type { CreativeProject } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const LIBRARY_STORAGE_KEY = 'aielegance-character-library'
const PB_ID = /^[a-z0-9]{15}$/

useHead({
  title: 'Character Creator — AI Elegance',
  meta: [{ name: 'description', content: 'Generate character portraits with multiple AI image models.' }]
})

const toast = useToast()
const route = useRoute()
const { isAuthenticated, initAuth, getAuthToken } = useAuth()
const { projects, loadServerProjects, clientReady } = useCreativeProject()

const name = ref('')
const description = ref('')
const stylePreset = ref<string>(CHARACTER_STYLE_PRESETS[0]!.value)
const selectedModelIds = ref<string[]>([DEFAULT_IMAGE_MODEL_ID])
const loading = ref(false)
const formError = ref('')
const lastPromptUsed = ref('')

type Slot = {
  status: 'loading' | 'done' | 'error'
  url?: string
  error?: string
  prompt_used?: string
  /** Set after a successful cloud save — enables “Use in Project”. */
  savedProjectId?: string
}
const slotByModel = ref<Record<string, Slot>>({})

const saveModalOpen = ref(false)
const pendingSave = ref<{ modelId: string; modelLabel: string; imageUrl: string } | null>(null)
const saveProjectId = ref('')
const saveTitle = ref('')
const saveError = ref('')
const cloudSaving = ref(false)
const contextProjectId = ref('')
const contextCharacterId = ref('')
const referenceImageUrl = ref<string | null>(null)
/** URL sent to the API (data URL or authenticated media URL). */
const referenceForApi = ref<string | null>(null)
const referenceLabel = ref('')
const referenceFileInput = ref<HTMLInputElement | null>(null)
const loadingProjectPortrait = ref(false)

const canLoadProjectPortrait = computed(
  () =>
    PB_ID.test(contextProjectId.value) &&
    isAuthenticated.value &&
    (!!contextCharacterId.value || !!name.value.trim())
)

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

function firstQueryString (v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

watch(
  () => route.query,
  (q) => {
    const incomingName = firstQueryString(q.name).trim()
    const incomingDescription = firstQueryString(q.description).trim()
    if (incomingName) name.value = incomingName.slice(0, 200)
    if (incomingDescription) {
      const d = incomingDescription.slice(0, 4000)
      const meta =
        /physical appearance only|skip story beats|featured portrait is saved for this character/i.test(d)
      if (!meta) description.value = d
    }
    const incomingProjectId = firstQueryString(q.projectId).trim()
    const incomingCharacterId = firstQueryString(q.characterId).trim()
    contextProjectId.value = PB_ID.test(incomingProjectId) ? incomingProjectId : ''
    contextCharacterId.value = PB_ID.test(incomingCharacterId) ? incomingCharacterId : ''
  },
  { immediate: true }
)

watch([isAuthenticated, clientReady], () => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
})

onMounted(() => {
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
})

function imageSrc (url: unknown): string {
  if (typeof url !== 'string') return ''
  return url.startsWith('data:') || url.startsWith('http') ? url : ''
}

function clearReferenceImage () {
  referenceImageUrl.value = null
  referenceForApi.value = null
  referenceLabel.value = ''
  if (referenceFileInput.value) referenceFileInput.value.value = ''
}

async function onReferenceFileSelected (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Please choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    input.value = ''
    return
  }
  try {
    let blob: Blob = file
    if (file.size > 3_500_000) {
      blob = await maybeCompressImageBlob(file)
    }
    const dataUrl = await blobToDataUrl(blob)
    referenceImageUrl.value = dataUrl
    referenceForApi.value = dataUrl
    referenceLabel.value = `Uploaded: ${file.name}`
    toast.showToast('Reference image attached.', 'success')
  } catch {
    toast.showToast('Could not read that image.', 'error')
    input.value = ''
  }
}

async function loadPortraitFromProject () {
  const pid = contextProjectId.value
  if (!PB_ID.test(pid)) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to load a project portrait.', 'info')
    return
  }
  loadingProjectPortrait.value = true
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(
      `/api/projects/${pid}/assets?kind=character`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const items = res.items || []
    const cid = contextCharacterId.value
    const normName = name.value.trim().toLowerCase().replace(/\s+/g, ' ')
    let hit: ProjectAsset | undefined
    if (cid) {
      const forChar = items.filter((a) => {
        const meta = a.metadata || {}
        return meta.character_id === cid && a.id
      })
      hit =
        forChar.find(a => a.metadata?.featured === true) ||
        forChar[0]
    }
    if (!hit && normName) {
      hit = items.find((a) => {
        const meta = a.metadata || {}
        const cname = typeof meta.character_name === 'string' ? meta.character_name.trim().toLowerCase().replace(/\s+/g, ' ') : ''
        return cname === normName && a.id
      })
    }
    if (!hit?.id) {
      toast.showToast('No saved portrait found for this character on that project.', 'warning')
      return
    }
    const apiUrl = appendPlaybackAccessToken(projectAssetMediaPath(pid, hit.id), token)
    referenceImageUrl.value = apiUrl
    referenceForApi.value = apiUrl
    referenceLabel.value = `From project: ${hit.title || 'Featured portrait'}`
    toast.showToast('Using project portrait as reference.', 'success')
  } catch {
    toast.showToast('Could not load project portrait.', 'error')
  } finally {
    loadingProjectPortrait.value = false
  }
}

const hasAnySlot = computed(() =>
  CHARACTER_CREATOR_IMAGE_MODELS.some(
    m => selectedModelIds.value.includes(m.id) && slotByModel.value[m.id] != null
  )
)

const doneCount = computed(() =>
  selectedModelIds.value.filter((id) => {
    const s = slotByModel.value[id]
    return s?.status === 'done' || s?.status === 'error'
  }).length
)

async function runGenerate () {
  formError.value = ''
  if (!selectedModelIds.value.length) {
    formError.value = 'Select at least one model.'
    return
  }

  const promptUsed = buildCharacterImagePrompt(
    name.value,
    description.value,
    stylePreset.value,
    { hasReferenceImage: !!referenceForApi.value }
  )
  lastPromptUsed.value = promptUsed
  loading.value = true

  const next: Record<string, Slot> = { ...slotByModel.value }
  for (const id of selectedModelIds.value) {
    next[id] = { status: 'loading', prompt_used: promptUsed }
  }
  slotByModel.value = next

  const ids = [...selectedModelIds.value]
  await Promise.allSettled(
    ids.map(async (modelId) => {
      try {
        const result = await $fetch<{ urls: string[] }>('/api/generate/image', {
          method: 'POST',
          body: {
            prompt: promptUsed,
            model: modelId,
            referenceImageUrl: referenceForApi.value || undefined
          }
        })
        const urls = result?.urls ?? []
        const first =
          urls.map((u: unknown) => (typeof u === 'string' ? u : '')).filter(Boolean)[0] ?? ''
        if (!first) {
          slotByModel.value = {
            ...slotByModel.value,
            [modelId]: { status: 'error', error: 'No image returned', prompt_used: promptUsed }
          }
          return
        }
        slotByModel.value = {
          ...slotByModel.value,
          [modelId]: { status: 'done', url: first, prompt_used: promptUsed }
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'data' in e
            ? String((e as { data?: { message?: string } }).data?.message ?? '')
            : e instanceof Error
              ? e.message
              : 'Failed'
        slotByModel.value = {
          ...slotByModel.value,
          [modelId]: { status: 'error', error: msg.slice(0, 160), prompt_used: promptUsed }
        }
      }
    })
  )

  loading.value = false
}

function openSaveModal (modelId: string, modelLabel: string, imageUrl: string) {
  pendingSave.value = { modelId, modelLabel, imageUrl }
  const charName = name.value.trim() || 'Character'
  saveTitle.value = `${charName} — ${modelLabel}`.slice(0, 500)
  saveError.value = ''
  const preferredPid = contextProjectId.value
  saveProjectId.value = (
    preferredPid && pbProjects.value.some(p => p.id === preferredPid)
      ? preferredPid
      : pbProjects.value[0]?.id
  ) ?? ''
  saveModalOpen.value = true
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects()
  }
  void initAuth()
}

function closeSaveModal () {
  if (cloudSaving.value) return
  saveModalOpen.value = false
  pendingSave.value = null
  saveError.value = ''
}

async function imageUrlToFile (imageUrl: string, baseName: string): Promise<File> {
  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new Error('Could not read image (try another model or regenerate).')
  }
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('Response was not an image.')
  }
  const ext =
    blob.type.includes('png')
      ? 'png'
      : blob.type.includes('jpeg') || blob.type.includes('jpg')
        ? 'jpg'
        : blob.type.includes('webp')
          ? 'webp'
          : blob.type.includes('gif')
            ? 'gif'
            : 'png'
  const safe = baseName.replace(/[^\w\s-]/g, '').trim().slice(0, 80) || 'character'
  // Live reverse proxies commonly cap request body size near 1MB. Large AI images can exceed this.
  // Compress aggressively when needed so "Save to account" remains reliable.
  const compressed = await maybeCompressImageBlob(blob)
  const outExt = compressed.type.includes('jpeg') ? 'jpg' : ext
  return new File([compressed], `${safe}.${outExt}`, { type: compressed.type || blob.type || 'image/png' })
}

async function maybeCompressImageBlob (blob: Blob): Promise<Blob> {
  const MAX_UPLOAD_BYTES = 900_000
  if (!blob.type.startsWith('image/')) return blob
  if (blob.size <= MAX_UPLOAD_BYTES) return blob
  const dataUrl = await blobToDataUrl(blob)
  const img = await loadImageFromDataUrl(dataUrl)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  const maxSide = 1400
  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(img, 0, 0, width, height)
  let quality = 0.86
  let out = await canvasToBlob(canvas, 'image/jpeg', quality)
  while (out && out.size > MAX_UPLOAD_BYTES && quality > 0.45) {
    quality -= 0.08
    out = await canvasToBlob(canvas, 'image/jpeg', quality)
  }
  return out || blob
}

function blobToDataUrl (blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Could not read image data'))
    r.readAsDataURL(blob)
  })
}

function loadImageFromDataUrl (dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = dataUrl
  })
}

function canvasToBlob (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

async function confirmCloudSave () {
  const pending = pendingSave.value
  if (!pending || !saveProjectId.value) return
  const token = getAuthToken()
  if (!token) {
    saveError.value = 'Session expired — sign in again.'
    return
  }
  cloudSaving.value = true
  saveError.value = ''
  try {
    const charName = name.value.trim() || 'Character'
    const linkedCharacter = await resolveOrCreateCharacterForSave(
      saveProjectId.value,
      charName,
      description.value.trim(),
      token
    )
    const file = await imageUrlToFile(
      pending.imageUrl,
      `${charName}-${pending.modelId}`.replace(/\s+/g, '-')
    )
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'character')
    fd.append('title', saveTitle.value.trim().slice(0, 500))
    fd.append('notes', description.value.trim().slice(0, 20_000))
    fd.append(
      'metadata',
      JSON.stringify({
        source: 'character_creator',
        model: pending.modelId,
        model_label: pending.modelLabel,
        character_name: linkedCharacter.name,
        character_id: linkedCharacter.id,
        featured: true,
        ...(contextProjectId.value ? { source_project_id: contextProjectId.value } : {}),
        prompt_used: slotByModel.value[pending.modelId]?.prompt_used ?? lastPromptUsed.value
      })
    )
    await $fetch(`/api/projects/${saveProjectId.value}/assets/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    })
    const pid = saveProjectId.value
    slotByModel.value = {
      ...slotByModel.value,
      [pending.modelId]: {
        ...slotByModel.value[pending.modelId]!,
        savedProjectId: pid
      }
    }
    toast.showToast('Saved to your library — Assets → Characters and this project.', 'success')
    closeSaveModal()
    await navigateTo(`/projects/${pid}/characters`)
  } catch (e: unknown) {
    const msg = saveErrorMessageFromUnknown(e)
    saveError.value = msg.slice(0, 260) || 'Could not save. Check project assets setup or try device-only.'
  } finally {
    cloudSaving.value = false
  }
}

async function resolveOrCreateCharacterForSave (
  projectId: string,
  characterName: string,
  roleDescription: string,
  token: string
): Promise<{ id: string; name: string }> {
  const targetName = characterName.trim().slice(0, 200) || 'Character'
  const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  const existing = await $fetch<{ characters: Array<{ id: string; name: string }> }>(
    `/api/projects/${projectId}/characters`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const hit = (existing.characters || []).find(c => normalize(c.name || '') === normalize(targetName))
  if (hit?.id) {
    const visual = roleDescription.trim()
    if (visual) {
      await $fetch(`/api/projects/${projectId}/characters/${hit.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { roleDescription: visual.slice(0, 10_000) }
      })
    }
    return { id: hit.id, name: hit.name || targetName }
  }
  const created = await $fetch<{ character?: { id: string; name: string } }>(`/api/projects/${projectId}/characters`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: targetName,
      roleDescription: roleDescription.slice(0, 10_000),
      screenSharePercent: null
    }
  })
  if (created.character?.id) {
    return { id: created.character.id, name: created.character.name || targetName }
  }
  throw new Error('Could not create character row for this image.')
}

function saveErrorMessageFromUnknown (e: unknown): string {
  if (!e || typeof e !== 'object') return ''
  const x = e as {
    data?: { message?: string; statusMessage?: string; error?: string }
    statusMessage?: string
    message?: string
    response?: { _data?: { message?: string; statusMessage?: string } }
  }
  const fromData =
    x.data?.message ||
    x.data?.statusMessage ||
    x.data?.error ||
    x.response?._data?.message ||
    x.response?._data?.statusMessage
  if (typeof fromData === 'string' && fromData.trim()) return fromData.trim()
  if (typeof x.statusMessage === 'string' && x.statusMessage.trim()) return x.statusMessage.trim()
  if (typeof x.message === 'string' && x.message.trim() && !x.message.includes('500 Internal Server Error')) {
    return x.message.trim()
  }
  return ''
}

function saveToDeviceOnly () {
  const pending = pendingSave.value
  if (!pending || typeof localStorage === 'undefined') return
  const prompt_used =
    slotByModel.value[pending.modelId]?.prompt_used ?? lastPromptUsed.value
  const entry: CharacterLibraryEntry = {
    model: pending.modelId,
    modelLabel: pending.modelLabel,
    image_url: pending.imageUrl,
    prompt_used,
    characterName: name.value.trim() || 'Unnamed',
    savedAt: new Date().toISOString()
  }
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY)
    const list: CharacterLibraryEntry[] = raw ? JSON.parse(raw) : []
    list.unshift(entry)
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(list.slice(0, 80)))
    toast.showToast('Saved on this device only.', 'success')
  } catch {
    toast.showToast('Could not save on this device.', 'error')
  }
}
</script>
