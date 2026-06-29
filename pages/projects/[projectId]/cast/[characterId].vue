<template>
  <div class="max-w-5xl">
    <nav class="text-sm text-gray-500 mb-6 flex flex-wrap items-center gap-2">
      <NuxtLink to="/assets/characters" class="hover:text-primary">Assets / Characters</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink :to="`/projects/${projectId}/characters`" class="hover:text-primary">Characters step</NuxtLink>
      <span aria-hidden="true">/</span>
      <span class="text-gray-900 truncate max-w-[12rem]">{{ character?.name || 'Character' }}</span>
    </nav>

    <ClientOnly>
      <template #fallback>
        <div class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10">
          <FilmReelLoader size="md" label="Loading character" sub-label="Fetching profile, images, and voice…" />
        </div>
      </template>

    <div v-if="loading" class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10">
      <FilmReelLoader size="md" label="Loading character" sub-label="Fetching profile, images, and voice…" />
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
    >
      {{ loadError }}
    </div>

    <template v-else-if="character">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Left: expression references + voice -->
        <div class="lg:w-80 shrink-0 space-y-5">
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 class="text-sm font-semibold text-gray-900">Expression & emotion references</h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  Add multiple photos — neutral, angry, joyful, fearful, etc. — so this character stays recognizable across moods.
                </p>
              </div>
            </div>

            <div
              v-if="featuredImageUrl && galleryImages.length > 1"
              class="relative bg-gray-900 aspect-[3/4] rounded-lg overflow-hidden mb-3"
            >
              <img
                :src="featuredImageUrl"
                :alt="character.name"
                class="absolute inset-0 w-full h-full object-cover"
              >
              <span class="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-primary text-white shadow">
                Featured
              </span>
              <span
                v-if="featuredImage?.expressionLabel"
                class="absolute bottom-2 left-2 right-2 px-2 py-1 text-[11px] font-medium rounded bg-black/60 text-white truncate"
              >
                {{ featuredImage.expressionLabel }}
              </span>
            </div>

            <ul v-if="galleryImages.length" class="grid grid-cols-2 gap-2 mb-3">
              <li
                v-for="img in galleryImages"
                :key="img.assetId"
                class="rounded-lg border bg-gray-900 overflow-hidden"
                :class="img.featured ? 'border-primary ring-2 ring-primary/40' : 'border-gray-200'"
              >
                <div class="relative aspect-[3/4] group">
                  <img :src="img.url" :alt="character.name" class="absolute inset-0 w-full h-full object-cover">
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      v-if="!img.featured"
                      type="button"
                      class="px-2 py-0.5 text-[10px] font-semibold rounded bg-white/90 text-gray-900 hover:bg-white disabled:opacity-50"
                      :disabled="featuringAssetId === img.assetId"
                      @click="setFeatured(img)"
                    >
                      {{ featuringAssetId === img.assetId ? '…' : 'Set featured' }}
                    </button>
                    <span v-else class="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary text-white">Featured</span>
                    <button
                      type="button"
                      class="px-2 py-0.5 text-[10px] font-semibold rounded bg-red-600/90 text-white hover:bg-red-600 disabled:opacity-50"
                      :disabled="deletingAssetId === img.assetId"
                      @click="deleteImage(img)"
                    >
                      {{ deletingAssetId === img.assetId ? '…' : 'Delete' }}
                    </button>
                  </div>
                </div>
                <div class="p-1.5 bg-white border-t border-gray-100">
                  <input
                    :value="expressionDraft[img.assetId] ?? img.expressionLabel"
                    type="text"
                    maxlength="80"
                    placeholder="e.g. Neutral, Angry"
                    class="w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    :disabled="savingExpressionAssetId === img.assetId"
                    @input="onExpressionInput(img.assetId, ($event.target as HTMLInputElement).value)"
                    @blur="saveExpressionLabel(img)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                  >
                </div>
              </li>
            </ul>

            <p v-else class="text-xs text-gray-500 mb-3 py-6 text-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
              No reference photos yet. Upload one or many below.
            </p>

            <label
              class="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-800 hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer transition-colors"
              :class="uploadingImage ? 'opacity-60 pointer-events-none' : ''"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                multiple
                class="sr-only"
                :disabled="uploadingImage"
                @change="onImageFilesPicked"
              >
              {{ uploadingImage ? uploadProgressLabel : (galleryImages.length ? 'Add more photos' : 'Add photos') }}
            </label>
            <p class="text-[10px] text-gray-400 mt-2 text-center">
              Select multiple files at once. Label each mood after upload.
            </p>
          </div>

          <!-- Voice & performance references -->
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between gap-2 mb-1">
              <h2 class="text-sm font-semibold text-gray-900">Voice & performance references</h2>
              <label
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-800 hover:border-primary hover:text-primary cursor-pointer transition-colors"
                :class="uploadingVoice ? 'opacity-60 pointer-events-none' : ''"
              >
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,video/mp4,video/webm,video/quicktime,.mp4,.mov"
                  class="sr-only"
                  :disabled="uploadingVoice"
                  @change="onReferenceClipPicked"
                >
                {{ uploadingVoice ? 'Uploading…' : 'Add clip' }}
              </label>
            </div>
            <p class="text-xs text-gray-500 mb-3">
              Short audio (~10s) for voice, or video clips for mannerisms, gestures, and on-camera delivery. Reference only — not used for cloning.
            </p>
            <input
              v-model="referenceClipLabel"
              type="text"
              maxlength="80"
              placeholder="Optional label, e.g. Angry outburst, Calm dialogue"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none mb-3"
              :disabled="uploadingVoice"
            >
            <ul v-if="referenceClips.length" class="space-y-2">
              <li
                v-for="s in referenceClips"
                :key="s.assetId"
                class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2"
              >
                <video
                  v-if="s.mediaType === 'video'"
                  :src="s.url"
                  controls
                  preload="metadata"
                  playsinline
                  class="w-full max-h-40 rounded bg-black"
                />
                <audio
                  v-else
                  :src="s.url"
                  controls
                  preload="metadata"
                  class="h-8 w-full"
                />
                <div class="flex items-center justify-between gap-2 mt-1">
                  <span class="text-[11px] text-gray-500 truncate">
                    {{ s.mannerismLabel || s.title }}
                    <span v-if="s.mediaType === 'video'" class="text-primary"> · video</span>
                  </span>
                  <button
                    type="button"
                    class="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-40 shrink-0"
                    :disabled="deletingAssetId === s.assetId"
                    @click="deleteReferenceClip(s.assetId)"
                  >
                    {{ deletingAssetId === s.assetId ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="text-xs text-gray-500">
              No clips yet. Upload a short MP3/WAV or a ~10s MP4/WebM of this character speaking or moving.
            </p>
          </div>
        </div>

        <!-- Right: consistency profile -->
        <div class="flex-1 min-w-0 space-y-6">
          <div>
            <input
              v-model="form.name"
              type="text"
              maxlength="200"
              class="text-2xl sm:text-3xl font-bold text-gray-900 w-full bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary focus:outline-none px-0 py-1"
              @blur="saveField"
            >
            <p class="text-xs text-gray-500 mt-1">
              Appearance, signature details, and avoid lists auto-inject into storyboard and video prompts for this character.
            </p>
          </div>

          <div
            v-if="linkedBibleEntity || castAssetCount > 0"
            class="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3"
          >
            <h3 class="text-sm font-semibold text-violet-950">Production Bible &amp; assets</h3>
            <p
              v-if="linkedBibleEntity"
              class="text-sm text-violet-900 mt-1"
            >
              Linked Bible entity:
              <NuxtLink
                :to="`/projects/${projectId}/bible`"
                class="font-medium underline hover:text-violet-950"
              >
                {{ linkedBibleEntity.name }}
              </NuxtLink>
              <span class="ml-2 text-[11px] font-medium text-violet-800">
                {{ linkedBibleEntity.confidenceLabel }}
              </span>
            </p>
            <p
              v-else
              class="text-sm text-violet-900/80 mt-1"
            >
              No linked Bible character entity yet. Use Production Bible → Link Cast to Bible to connect cast and canon.
            </p>
            <p class="text-xs text-violet-900/70 mt-1">
              {{ castAssetCount }} project asset{{ castAssetCount === 1 ? '' : 's' }} linked to this cast member
              <span v-if="assets.length !== castAssetCount"> ({{ assets.length }} on this profile)</span>.
            </p>
          </div>

          <ProfileField
            label="Role in the story"
            hint="What they want, their function in the plot, key relationships."
            :model-value="form.roleDescription"
            placeholder="e.g. Grizzled hunter and reluctant protector; Moose’s father."
            :rows="3"
            @update:model-value="(v) => { form.roleDescription = v }"
            @commit="saveField"
          />

          <ProfileField
            label="Appearance & wardrobe (visual anchor)"
            hint="Locked physical look so every generated image matches: age, build, face, hair, skin, signature wardrobe, distinguishing marks."
            :model-value="form.appearanceDescription"
            placeholder="e.g. Late 50s, lean and weathered. Grey stubble, deep-set eyes. Faded olive work shirt, worn denim, scuffed leather boots. Scar over left brow."
            :rows="5"
            @update:model-value="(v) => { form.appearanceDescription = v }"
            @commit="saveField"
          />

          <ProfileField
            label="Personality & mannerisms"
            hint="Attitude, speech rhythm, gestures, and behavior so performance stays in character."
            :model-value="form.personality"
            placeholder="e.g. Terse and watchful; speaks in short sentences. Distrusts strangers but fiercely loyal. Tends to look away before answering."
            :rows="4"
            @update:model-value="(v) => { form.personality = v }"
            @commit="saveField"
          />

          <ProfileField
            label="Voice notes (tone, pace, accent)"
            hint="Describe how they sound — pairs with the voice clips on the left."
            :model-value="form.voiceDescription"
            placeholder="e.g. Low, deliberate; slight rasp; flat Midwestern."
            :rows="2"
            @update:model-value="(v) => { form.voiceDescription = v }"
            @commit="saveField"
          />

          <ProfileField
            label="Signature details"
            hint="Recurring props, accessories, catchphrases, or tics that should always show up."
            :model-value="form.signatureDetails"
            placeholder="e.g. Always carries a brass compass. Says “we move at first light.” Rolls a coin across his knuckles when thinking."
            :rows="3"
            @update:model-value="(v) => { form.signatureDetails = v }"
            @commit="saveField"
          />

          <ProfileField
            label="Avoid / never show"
            hint="Things that must never appear for this character — merged into STRICT EXCLUSIONS on every storyboard and video prompt."
            :model-value="form.avoidDescription"
            placeholder="e.g. No beard, no glasses, never in a suit, no modern sneakers, no smiling."
            :rows="2"
            :maxlength="2000"
            @update:model-value="(v) => { form.avoidDescription = v }"
            @commit="saveField"
          />

          <div v-if="lockedPortraitPrompt" class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-semibold text-gray-900">Locked portrait prompt</h3>
              <button
                type="button"
                class="text-xs font-medium text-primary hover:underline"
                @click="copyPrompt"
              >
                {{ copied ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p class="text-xs text-gray-500 mb-2">
              The exact prompt used to generate the featured image — reuse it (with new actions) so the face/wardrobe stay identical.
            </p>
            <pre class="text-[12px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">{{ lockedPortraitPrompt }}</pre>
          </div>

          <div class="flex flex-wrap gap-3 pt-2">
            <NuxtLink
              :to="characterCreatorTo"
              class="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              Open in Character Creator
            </NuxtLink>
            <NuxtLink
              :to="`/projects/${projectId}/characters`"
              class="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              All characters
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { appendPlaybackAccessToken, projectAssetMediaPath, projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import { isCharacterPortraitAsset, isCharacterReferenceClipAsset } from '~/lib/character-voice-assets'
import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import {
  uploadCharacterReferenceClip,
  validateCharacterReferenceClipFile
} from '~/lib/upload-character-voice-sample'
import { visualBriefForCharacterCreator } from '~/lib/character-visual-description'
import { castBibleConfidenceLabel, resolveCastCharacterToBibleEntity } from '~/lib/bible-cast-bridge'
import { countAssetsForCastCharacter } from '~/lib/bible-cast-asset-bridge'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleRelationship } from '~/types/bible-relationship'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

const route = useRoute()
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = computed(() => String(route.params.projectId || ''))
const characterId = computed(() => String(route.params.characterId || ''))
const nameHint = computed(() => {
  const q = route.query.name
  return typeof q === 'string' ? q : Array.isArray(q) ? String(q[0] || '') : ''
})

// The route id can be stale (e.g. an image asset still pointing at a deleted
// character). The API self-heals by name and returns the live record, so all
// edits/uploads must target the resolved id — never the raw route param.
const effectiveCharacterId = computed(() => character.value?.id || characterId.value)

const loading = ref(true)
const loadError = ref('')
const character = ref<CreativeCharacter | null>(null)
const assets = ref<ProjectAsset[]>([])
// True when there is no backing creative_characters row yet (profile is built
// from assets). The first save creates a real record and re-links assets to it.
const synthetic = ref(false)

const uploadingImage = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })
const uploadingVoice = ref(false)
const referenceClipLabel = ref('')
const deletingAssetId = ref('')
const featuringAssetId = ref('')
const savingExpressionAssetId = ref('')
const copied = ref(false)
const expressionDraft = reactive<Record<string, string>>({})
const linkedBibleEntity = ref<{
  id: string
  name: string
  confidenceLabel: string
} | null>(null)
const projectAssets = ref<ProjectAsset[]>([])

const castAssetCount = computed(() =>
  countAssetsForCastCharacter(projectAssets.value, effectiveCharacterId.value)
)

const uploadProgressLabel = computed(() => {
  const { current, total } = uploadProgress.value
  if (total <= 1) return 'Uploading…'
  return `Uploading ${current} of ${total}…`
})

const form = reactive({
  name: '',
  roleDescription: '',
  appearanceDescription: '',
  personality: '',
  voiceDescription: '',
  signatureDetails: '',
  avoidDescription: ''
})

function syncForm (c: CreativeCharacter) {
  form.name = c.name || ''
  form.roleDescription = c.roleDescription || ''
  form.appearanceDescription = c.appearanceDescription || ''
  form.personality = c.personality || ''
  form.voiceDescription = c.voiceDescription || ''
  form.signatureDetails = c.signatureDetails || ''
  form.avoidDescription = c.avoidDescription || ''
}

function imageUrl (a: ProjectAsset): string {
  if (a.projectId && a.id && PB_ID.test(a.projectId)) {
    return appendPlaybackAccessToken(projectAssetMediaPath(a.projectId, a.id), getAuthToken())
  }
  return (a.fileUrl || '').trim()
}

type GalleryImage = {
  assetId: string
  url: string
  featured: boolean
  promptUsed: string
  expressionLabel: string
  ts: string
}

function expressionLabelFromMeta (meta: Record<string, unknown>): string {
  const v = meta.expression_label ?? meta.emotion
  return typeof v === 'string' ? v.trim() : ''
}

function syncExpressionDrafts (images: GalleryImage[]) {
  for (const key of Object.keys(expressionDraft)) {
    if (!images.some(img => img.assetId === key)) delete expressionDraft[key]
  }
  for (const img of images) {
    if (expressionDraft[img.assetId] === undefined) {
      expressionDraft[img.assetId] = img.expressionLabel
    }
  }
}

const galleryImages = computed<GalleryImage[]>(() => {
  const out: GalleryImage[] = []
  for (const a of assets.value) {
    if (!a.fileUrl) continue
    const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
    if (!isCharacterPortraitAsset(meta as Record<string, unknown>)) continue
    out.push({
      assetId: a.id,
      url: imageUrl(a),
      featured: meta.featured === true,
      promptUsed: typeof meta.prompt_used === 'string' ? meta.prompt_used.trim() : '',
      expressionLabel: expressionLabelFromMeta(meta as Record<string, unknown>),
      ts: a.updated || a.created || ''
    })
  }
  return out.sort((x, y) => {
    if (x.featured !== y.featured) return x.featured ? -1 : 1
    return (y.ts || '').localeCompare(x.ts || '')
  })
})

watch(galleryImages, (images) => { syncExpressionDrafts(images) }, { immediate: true })

const featuredImage = computed(() => galleryImages.value[0] || null)
const featuredImageUrl = computed(() => featuredImage.value?.url || '')
const lockedPortraitPrompt = computed(() => featuredImage.value?.promptUsed || '')

const referenceClips = computed(() => {
  const out: {
    assetId: string
    url: string
    title: string
    ts: string
    mediaType: 'audio' | 'video'
    mannerismLabel?: string
  }[] = []
  for (const a of assets.value) {
    if (!a.id || !a.projectId) continue
    const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
    if (!isCharacterReferenceClipAsset(meta as Record<string, unknown>)) continue
    const mediaType =
      meta.media_type === 'video' || meta.source === 'character_performance_clip'
        ? 'video'
        : 'audio'
    const mannerismLabel =
      typeof meta.mannerism_label === 'string' ? meta.mannerism_label.trim() : ''
    out.push({
      assetId: a.id,
      url: projectAssetPlaybackSrc({ id: a.id, projectId: a.projectId, fileUrl: a.fileUrl || '' }, getAuthToken()),
      title: (a.title || 'Reference clip').trim(),
      ts: a.created || a.updated || '',
      mediaType,
      mannerismLabel: mannerismLabel || undefined
    })
  }
  return out.sort((x, y) => (y.ts || '').localeCompare(x.ts || ''))
})

const characterCreatorTo = computed(() => {
  const q: Record<string, string> = { name: form.name }
  const description = visualBriefForCharacterCreator({
    name: form.name,
    roleDescription: [form.roleDescription, form.appearanceDescription].filter(Boolean).join('\n\n'),
    portraitUrl: featuredImageUrl.value || undefined,
    portraitNotes: '',
    portraitPromptUsed: lockedPortraitPrompt.value
  })
  if (description) q.description = description
  if (projectId.value && PB_ID.test(projectId.value)) q.projectId = projectId.value
  if (effectiveCharacterId.value && PB_ID.test(effectiveCharacterId.value)) q.characterId = effectiveCharacterId.value
  return { path: '/character-creator', query: q }
})

async function load () {
  if (!isAuthenticated.value) {
    loading.value = false
    loadError.value = 'Sign in to view this character.'
    return
  }
  const token = getAuthToken()
  if (!token || !projectId.value || !characterId.value) {
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<{ character: CreativeCharacter; assets: ProjectAsset[]; synthetic?: boolean }>(
      `/api/projects/${projectId.value}/characters/${characterId.value}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        query: nameHint.value ? { name: nameHint.value } : undefined
      }
    )
    character.value = res.character
    assets.value = res.assets || []
    synthetic.value = res.synthetic === true
    syncForm(res.character)
    void loadBibleEntityLink(token)
  } catch (e: unknown) {
    loadError.value = formatApiFetchError(e, 'Could not load character')
  } finally {
    loading.value = false
  }
}

async function loadBibleEntityLink (token: string) {
  linkedBibleEntity.value = null
  projectAssets.value = []
  const pid = projectId.value
  const cid = effectiveCharacterId.value
  const cname = character.value?.name || ''
  if (!PB_ID.test(pid) || !PB_ID.test(cid) || !cname.trim()) return
  try {
    const [entRes, relRes, assetRes] = await Promise.all([
      $fetch<{ entities: BibleEntity[] }>(`/api/projects/${pid}/bible/entities`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      $fetch<{ relationships: BibleRelationship[] }>(`/api/projects/${pid}/bible/relationships`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      $fetch<{ items: ProjectAsset[] }>(`/api/projects/${pid}/assets`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ items: [] as ProjectAsset[] }))
    ])
    projectAssets.value = assetRes.items || []
    const link = resolveCastCharacterToBibleEntity(
      cid,
      cname,
      entRes.entities || [],
      relRes.relationships || []
    )
    if (!link || link.confidence === 'ambiguous') return
    const ent = (entRes.entities || []).find((e) => e.id === link.entityId)
    if (!ent) return
    linkedBibleEntity.value = {
      id: ent.id,
      name: ent.name,
      confidenceLabel: castBibleConfidenceLabel(link.confidence)
    }
  } catch {
    /* fail open */
  }
}

async function saveField () {
  const token = getAuthToken()
  const c = character.value
  if (!token || !c) return
  const payload = {
    name: form.name.trim(),
    roleDescription: form.roleDescription,
    appearanceDescription: form.appearanceDescription,
    personality: form.personality,
    voiceDescription: form.voiceDescription,
    signatureDetails: form.signatureDetails,
    avoidDescription: form.avoidDescription
  }
  if (
    payload.name === (c.name || '') &&
    payload.roleDescription === (c.roleDescription || '') &&
    payload.appearanceDescription === (c.appearanceDescription || '') &&
    payload.personality === (c.personality || '') &&
    payload.voiceDescription === (c.voiceDescription || '') &&
    payload.signatureDetails === (c.signatureDetails || '') &&
    payload.avoidDescription === (c.avoidDescription || '')
  ) return
  if (!payload.name) {
    form.name = c.name
    return
  }
  try {
    // No backing record yet → create one, then re-link this character's assets
    // to the freshly created id so images/voice stay attached.
    if (synthetic.value) {
      const createdId = await createBackingCharacter(token, payload.name)
      if (!createdId) return
    }
    const res = await $fetch<{ character: CreativeCharacter }>(
      `/api/projects/${projectId.value}/characters/${effectiveCharacterId.value}`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: payload }
    )
    character.value = res.character
    synthetic.value = false
    syncForm(res.character)
    toast.showToast('Saved.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not save'), 'error')
  }
}

async function createBackingCharacter (token: string, name: string): Promise<string> {
  const res = await $fetch<{ character: CreativeCharacter }>(
    `/api/projects/${projectId.value}/characters`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: { name } }
  )
  const newId = res.character?.id || ''
  if (!newId) return ''
  character.value = res.character
  synthetic.value = false
  // Re-point any assets that referenced the old (stale/synthetic) id.
  for (const a of assets.value) {
    if (!a.id || !PB_ID.test(a.id)) continue
    const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
    if (meta.character_id === newId) continue
    try {
      await $fetch(`/api/projects/${projectId.value}/assets/${a.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { metadata: { ...meta, character_id: newId, character_name: name } }
      })
    } catch {
      /* best-effort relink; GET still matches by the old id meanwhile */
    }
  }
  return newId
}

async function uploadCharacterImage (token: string, file: File, opts: { featured: boolean; expressionLabel?: string }) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file (JPEG, PNG, WebP, or GIF).')
  }
  const uploadFile = await prepareImageFileForUpload(file)
  const label = (opts.expressionLabel || '').trim()
  const titleSuffix = label || 'reference'
  const fd = new FormData()
  fd.append('file', uploadFile)
  fd.append('kind', 'character')
  fd.append('title', `${form.name || 'Character'} — ${titleSuffix}`.slice(0, 500))
  fd.append('notes', (form.appearanceDescription || form.roleDescription || '').slice(0, 20000))
  fd.append('metadata', JSON.stringify({
    source: 'character_upload',
    character_name: form.name,
    character_id: effectiveCharacterId.value,
    featured: opts.featured,
    ...(label ? { expression_label: label } : {})
  }))
  await $fetch(`/api/projects/${projectId.value}/assets/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  })
}

async function onImageFilesPicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = input.files ? [...input.files] : []
  input.value = ''
  if (!files.length) return

  const token = getAuthToken()
  if (!token) return

  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  if (!imageFiles.length) {
    toast.showToast('Choose image files (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  if (imageFiles.length < files.length) {
    toast.showToast('Skipped non-image files.', 'warning')
  }

  uploadingImage.value = true
  uploadProgress.value = { current: 0, total: imageFiles.length }
  let uploaded = 0
  const hadImages = galleryImages.value.length > 0

  try {
    for (let i = 0; i < imageFiles.length; i++) {
      uploadProgress.value = { current: i + 1, total: imageFiles.length }
      await uploadCharacterImage(token, imageFiles[i], {
        featured: !hadImages && i === 0
      })
      uploaded++
    }
    toast.showToast(
      uploaded === 1 ? 'Photo added.' : `${uploaded} photos added.`,
      'success'
    )
    await load()
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not upload image')
    if (uploaded > 0) {
      toast.showToast(`${uploaded} uploaded; then failed: ${msg}`, 'warning')
      await load()
    } else {
      toast.showToast(msg, 'error')
    }
  } finally {
    uploadingImage.value = false
    uploadProgress.value = { current: 0, total: 0 }
  }
}

function onExpressionInput (assetId: string, value: string) {
  expressionDraft[assetId] = value
}

async function saveExpressionLabel (img: GalleryImage) {
  const token = getAuthToken()
  if (!token) return
  const next = (expressionDraft[img.assetId] ?? '').trim()
  if (next === img.expressionLabel) return

  savingExpressionAssetId.value = img.assetId
  try {
    const asset = assets.value.find(a => a.id === img.assetId)
    const meta = (asset?.metadata && typeof asset.metadata === 'object') ? asset.metadata : {}
    await $fetch(`/api/projects/${projectId.value}/assets/${img.assetId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        metadata: {
          ...meta,
          character_id: effectiveCharacterId.value,
          character_name: form.name,
          expression_label: next
        },
        title: next
          ? `${form.name || 'Character'} — ${next}`.slice(0, 500)
          : undefined
      }
    })
    expressionDraft[img.assetId] = next
    await load()
  } catch (e: unknown) {
    expressionDraft[img.assetId] = img.expressionLabel
    toast.showToast(formatApiFetchError(e, 'Could not save label'), 'error')
  } finally {
    savingExpressionAssetId.value = ''
  }
}

async function setFeatured (img: GalleryImage) {
  const token = getAuthToken()
  if (!token) return
  featuringAssetId.value = img.assetId
  try {
    for (const a of assets.value) {
      if (!a.fileUrl || !a.id || !PB_ID.test(a.id)) continue
      const meta = (a.metadata && typeof a.metadata === 'object') ? a.metadata : {}
      if (!isCharacterPortraitAsset(meta as Record<string, unknown>)) continue
      const shouldFeature = a.id === img.assetId
      if ((meta.featured === true) === shouldFeature) continue
      await $fetch(`/api/projects/${projectId.value}/assets/${a.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { metadata: { ...meta, character_id: effectiveCharacterId.value, character_name: form.name, featured: shouldFeature } }
      })
    }
    toast.showToast('Featured image updated.', 'success')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not set featured image'), 'error')
  } finally {
    featuringAssetId.value = ''
  }
}

async function deleteImage (img: GalleryImage) {
  if (!globalThis.confirm('Delete this image?')) return
  await removeAsset(img.assetId)
}

async function deleteReferenceClip (assetId: string) {
  if (!globalThis.confirm('Remove this reference clip?')) return
  await removeAsset(assetId)
}

async function removeAsset (assetId: string) {
  const token = getAuthToken()
  if (!token) return
  deletingAssetId.value = assetId
  try {
    await $fetch(`/api/projects/${projectId.value}/assets/${assetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.showToast('Removed.', 'success')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not remove'), 'error')
  } finally {
    deletingAssetId.value = ''
  }
}

async function onReferenceClipPicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const err = validateCharacterReferenceClipFile(file)
  if (err) {
    toast.showToast(err, 'warning')
    return
  }
  const token = getAuthToken()
  if (!token) return
  uploadingVoice.value = true
  try {
    await uploadCharacterReferenceClip({
      projectId: projectId.value,
      characterId: effectiveCharacterId.value,
      characterName: form.name,
      file,
      token,
      mannerismLabel: referenceClipLabel.value.trim() || undefined
    })
    referenceClipLabel.value = ''
    toast.showToast('Reference clip added.', 'success')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not upload clip'), 'error')
  } finally {
    uploadingVoice.value = false
  }
}

async function copyPrompt () {
  try {
    await navigator.clipboard.writeText(lockedPortraitPrompt.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    /* clipboard blocked */
  }
}

watch([isAuthenticated, projectId, characterId], () => { void load() }, { immediate: true })

useHead({
  title: computed(() => (character.value?.name ? `${character.value.name} — Character` : 'Character'))
})
</script>
