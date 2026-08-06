<template>
  <div class="max-w-6xl character-lookbook">
    <nav class="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-2">
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
        <!-- Character lookbook sheet -->
        <section
          class="lookbook-sheet relative overflow-hidden rounded-2xl border border-stone-800/80 shadow-2xl"
          aria-label="Character lookbook"
        >
          <div class="lookbook-sheet__atmosphere" aria-hidden="true" />

          <!-- Header -->
          <header class="relative z-10 px-5 sm:px-8 pt-7 pb-5 border-b border-white/10">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <input
                  v-model="form.name"
                  type="text"
                  maxlength="200"
                  class="lookbook-name w-full bg-transparent border-0 border-b border-transparent hover:border-white/20 focus:border-primary focus:outline-none px-0 py-1 text-white placeholder:text-white/30"
                  placeholder="CHARACTER NAME"
                  @blur="saveField"
                >
                <p
                  v-if="headerRoleLine"
                  class="mt-2 text-[11px] sm:text-xs tracking-[0.22em] uppercase text-primary/90 font-medium"
                >
                  {{ headerRoleLine }}
                </p>
                <ul
                  v-if="traitTags.length"
                  class="mt-3 flex flex-wrap gap-x-3 gap-y-1"
                >
                  <li
                    v-for="tag in traitTags"
                    :key="tag"
                    class="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-stone-300/90"
                  >
                    {{ tag }}
                  </li>
                </ul>
              </div>
              <span
                class="inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full bg-black/30 border border-white/10"
                :class="{
                  'text-stone-400': saveStatus === 'idle',
                  'text-amber-300': saveStatus === 'unsaved',
                  'text-stone-300': saveStatus === 'saving',
                  'text-emerald-300': saveStatus === 'saved',
                  'text-red-300': saveStatus === 'error'
                }"
                aria-live="polite"
              >
                {{ saveStatusText }}
              </span>
            </div>
          </header>

          <!-- Main lookbook grid -->
          <div class="relative z-10 grid lg:grid-cols-12 gap-0 lg:gap-0">
            <!-- Left: bio + hero portrait -->
            <div class="lg:col-span-3 px-5 sm:px-6 py-6 border-b lg:border-b-0 lg:border-r border-white/10 space-y-5">
              <dl class="space-y-2.5 text-sm">
                <div>
                  <dt class="lookbook-label">Name</dt>
                  <dd class="text-stone-100 font-medium tracking-wide">{{ form.name || '—' }}</dd>
                </div>
                <div v-if="form.roleDescription.trim()">
                  <dt class="lookbook-label">Role</dt>
                  <dd class="text-stone-300 text-xs leading-relaxed line-clamp-4">{{ form.roleDescription }}</dd>
                </div>
                <div v-if="form.personality.trim()">
                  <dt class="lookbook-label">Vibe</dt>
                  <dd class="text-stone-300 text-xs leading-relaxed line-clamp-3">{{ form.personality }}</dd>
                </div>
                <div v-if="form.voiceDescription.trim()">
                  <dt class="lookbook-label">Voice</dt>
                  <dd class="text-stone-300 text-xs leading-relaxed line-clamp-2">{{ form.voiceDescription }}</dd>
                </div>
              </dl>

              <div class="lookbook-portrait relative aspect-[3/4] overflow-hidden bg-black/50 ring-1 ring-white/15">
                <img
                  v-if="featuredImageUrl"
                  :src="featuredImageUrl"
                  :alt="form.name || 'Character'"
                  class="absolute inset-0 w-full h-full object-cover lookbook-portrait__img"
                >
                <div
                  v-else
                  class="absolute inset-0 flex items-center justify-center text-center px-4"
                >
                  <p class="text-xs text-stone-400 leading-relaxed">
                    Add a featured portrait to anchor this lookbook.
                  </p>
                </div>
                <span
                  v-if="featuredImage?.expressionLabel"
                  class="absolute bottom-0 inset-x-0 px-2 py-1.5 text-[10px] tracking-[0.2em] uppercase text-center bg-black/65 text-stone-100"
                >
                  {{ featuredImage.expressionLabel }}
                </span>
              </div>
            </div>

            <!-- Center: turnaround / expression strip -->
            <div class="lg:col-span-6 px-4 sm:px-5 py-6 border-b lg:border-b-0 lg:border-r border-white/10">
              <div class="flex items-center justify-between gap-2 mb-3">
                <h2 class="lookbook-label !mb-0">Reference plates</h2>
                <label
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase rounded border border-white/20 text-stone-100 hover:border-primary hover:text-primary cursor-pointer transition-colors"
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
                  {{ uploadingImage ? uploadProgressLabel : (galleryImages.length ? 'Add plates' : 'Upload plates') }}
                </label>
              </div>

              <div
                v-if="galleryImages.length"
                class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5"
              >
                <figure
                  v-for="img in galleryImages"
                  :key="img.assetId"
                  class="lookbook-plate group relative"
                  :class="img.featured ? 'ring-2 ring-primary' : 'ring-1 ring-white/15'"
                >
                  <div class="relative aspect-[3/4] bg-black overflow-hidden">
                    <img
                      :src="img.url"
                      :alt="form.name"
                      class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    >
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
                    <div class="absolute inset-x-0 bottom-0 p-1.5 space-y-1">
                      <input
                        :value="expressionDraft[img.assetId] ?? img.expressionLabel"
                        type="text"
                        maxlength="80"
                        placeholder="Label view"
                        class="w-full bg-black/50 border border-white/20 rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase text-stone-100 placeholder:text-stone-500 focus:border-primary focus:outline-none"
                        :disabled="savingExpressionAssetId === img.assetId"
                        @input="onExpressionInput(img.assetId, ($event.target as HTMLInputElement).value)"
                        @blur="saveExpressionLabel(img)"
                        @keydown.enter="($event.target as HTMLInputElement).blur()"
                      >
                      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          v-if="!img.featured"
                          type="button"
                          class="flex-1 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-white/90 text-gray-900"
                          :disabled="featuringAssetId === img.assetId"
                          @click="setFeatured(img)"
                        >
                          Feature
                        </button>
                        <button
                          type="button"
                          class="flex-1 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-red-700/90 text-white"
                          :disabled="deletingAssetId === img.assetId"
                          @click="deleteImage(img)"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <span
                      v-if="img.featured"
                      class="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary text-gray-950"
                    >
                      Featured
                    </span>
                  </div>
                </figure>
              </div>

              <p
                v-else
                class="text-xs text-stone-400 py-16 text-center border border-dashed border-white/15 rounded-lg"
              >
                Upload front / 3⁄4 / profile / expression plates — labeled views become this character’s turnaround.
              </p>

              <p class="mt-3 text-[10px] text-stone-500 tracking-wide">
                Tip: label plates like Front, 3⁄4, Profile, Back, Angry, Calm — same idea as a studio turnaround sheet.
              </p>
            </div>

            <!-- Right: wardrobe + signature -->
            <div class="lg:col-span-3 px-5 sm:px-6 py-6 space-y-5">
              <div>
                <h2 class="lookbook-label">Wardrobe &amp; look</h2>
                <p
                  v-if="form.appearanceDescription.trim()"
                  class="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap"
                >
                  {{ form.appearanceDescription }}
                </p>
                <p v-else class="text-xs text-stone-500 italic">
                  No locked appearance yet — edit below so every frame stays consistent.
                </p>
              </div>

              <div>
                <h2 class="lookbook-label">Key items</h2>
                <ul
                  v-if="signatureBullets.length"
                  class="space-y-1.5"
                >
                  <li
                    v-for="(item, i) in signatureBullets"
                    :key="i"
                    class="text-xs text-stone-300 leading-snug flex gap-2"
                  >
                    <span class="text-primary shrink-0" aria-hidden="true">▸</span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
                <p v-else class="text-xs text-stone-500 italic">
                  Props, accessories, and recurring details go here.
                </p>
              </div>

              <div v-if="form.avoidDescription.trim()">
                <h2 class="lookbook-label">Never show</h2>
                <p class="text-xs text-red-200/80 leading-relaxed whitespace-pre-wrap">
                  {{ form.avoidDescription }}
                </p>
              </div>

              <div
                v-if="linkedBibleEntity || castAssetCount > 0"
                class="pt-3 border-t border-white/10"
              >
                <h2 class="lookbook-label">Bible &amp; assets</h2>
                <p
                  v-if="linkedBibleEntity"
                  class="text-xs text-stone-300"
                >
                  Linked:
                  <NuxtLink
                    :to="`/projects/${projectId}/bible`"
                    class="text-primary hover:underline font-medium"
                  >
                    {{ linkedBibleEntity.name }}
                  </NuxtLink>
                </p>
                <p class="text-[11px] text-stone-500 mt-1">
                  {{ castAssetCount }} linked asset{{ castAssetCount === 1 ? '' : 's' }}
                </p>
              </div>

              <div class="flex flex-col gap-2 pt-1">
                <NuxtLink
                  :to="characterCreatorTo"
                  class="inline-flex justify-center px-3 py-2 text-xs font-semibold tracking-wide uppercase rounded bg-primary text-gray-950 hover:bg-primary/90 transition-colors"
                >
                  Open Character Creator
                </NuxtLink>
                <NuxtLink
                  :to="`/projects/${projectId}/characters`"
                  class="inline-flex justify-center px-3 py-2 text-xs font-medium tracking-wide uppercase rounded border border-white/20 text-stone-200 hover:border-primary/50 hover:text-primary transition-colors"
                >
                  All characters
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Footer quote / tagline -->
          <footer class="relative z-10 px-5 sm:px-8 py-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p class="text-[11px] tracking-[0.2em] uppercase text-stone-400">
              {{ form.name || 'Character' }}
              <span v-if="form.roleDescription" class="text-stone-500"> — {{ roleShort }}</span>
            </p>
            <p
              v-if="footerQuote"
              class="text-xs italic text-stone-400/90 sm:text-right max-w-md"
            >
              “{{ footerQuote }}”
            </p>
          </footer>
        </section>

        <!-- Editable dossier (functional fields) -->
        <details class="mt-6 group rounded-xl border border-gray-200 bg-white open:shadow-sm">
          <summary class="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-gray-900">
            <span>Edit dossier fields</span>
            <span class="text-xs font-normal text-gray-500 group-open:hidden">Role, look, voice, avoid…</span>
            <span class="text-gray-400 text-lg leading-none group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
          </summary>
          <div class="px-5 pb-6 space-y-5 border-t border-gray-100 pt-5">
            <ProfileField
              label="Role in the story"
              hint="What they want, their function in the plot, key relationships."
              :model-value="form.roleDescription"
              placeholder="e.g. Field paleontologist and reluctant expedition lead."
              :rows="3"
              @update:model-value="(v) => { form.roleDescription = v }"
              @commit="saveField"
            />
            <ProfileField
              label="Appearance & wardrobe (visual anchor)"
              hint="Locked physical look so every generated image matches."
              :model-value="form.appearanceDescription"
              placeholder="e.g. Late 20s, sun-weathered, blonde braid. Utility shirt, leather belt, scuffed boots."
              :rows="5"
              @update:model-value="(v) => { form.appearanceDescription = v }"
              @commit="saveField"
            />
            <ProfileField
              label="Personality & mannerisms"
              hint="Attitude, speech rhythm, gestures — also feeds the trait tags in the lookbook header."
              :model-value="form.personality"
              placeholder="e.g. Fearless · Resourceful · Independent"
              :rows="3"
              @update:model-value="(v) => { form.personality = v }"
              @commit="saveField"
            />
            <ProfileField
              label="Voice notes (tone, pace, accent)"
              hint="Describe how they sound — pairs with voice clips below."
              :model-value="form.voiceDescription"
              placeholder="e.g. Soft Southern drawl; calm under pressure."
              :rows="2"
              @update:model-value="(v) => { form.voiceDescription = v }"
              @commit="saveField"
            />
            <ProfileField
              label="Signature details / key items"
              hint="Recurring props and tics — shown as Key items on the lookbook."
              :model-value="form.signatureDetails"
              placeholder="e.g. Leather field journal. Brass compass. Always carries a camera."
              :rows="3"
              @update:model-value="(v) => { form.signatureDetails = v }"
              @commit="saveField"
            />
            <ProfileField
              label="Avoid / never show"
              hint="Merged into STRICT EXCLUSIONS on storyboard and video prompts."
              :model-value="form.avoidDescription"
              placeholder="e.g. No modern sneakers, no suit, never clean nails."
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
                Reuse this (with new actions) so face and wardrobe stay identical.
              </p>
              <pre class="text-[12px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">{{ lockedPortraitPrompt }}</pre>
            </div>
          </div>
        </details>

        <!-- Voice & performance -->
        <section class="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div class="flex items-center justify-between gap-2 mb-1">
            <h2 class="text-sm font-semibold text-gray-900">Voice &amp; performance references</h2>
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
            Short audio (~10s) for voice, or video for mannerisms. Reference only — not used for cloning.
          </p>
          <input
            v-model="referenceClipLabel"
            type="text"
            maxlength="80"
            placeholder="Optional label, e.g. Angry outburst, Calm dialogue"
            class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none mb-3"
            :disabled="uploadingVoice"
          >
          <ul v-if="referenceClips.length" class="grid sm:grid-cols-2 gap-3">
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
            No clips yet. Upload a short MP3/WAV or a ~10s MP4/WebM.
          </p>
        </section>
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

const effectiveCharacterId = computed(() => character.value?.id || characterId.value)

const loading = ref(true)
const loadError = ref('')
const character = ref<CreativeCharacter | null>(null)
const assets = ref<ProjectAsset[]>([])
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

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'
const saveStatus = ref<SaveStatus>('idle')
const lastSavedAt = ref<number | null>(null)

const isDirty = computed(() => {
  const c = character.value
  if (!c) return false
  return (
    form.name.trim() !== (c.name || '') ||
    form.roleDescription !== (c.roleDescription || '') ||
    form.appearanceDescription !== (c.appearanceDescription || '') ||
    form.personality !== (c.personality || '') ||
    form.voiceDescription !== (c.voiceDescription || '') ||
    form.signatureDetails !== (c.signatureDetails || '') ||
    form.avoidDescription !== (c.avoidDescription || '')
  )
})

const saveStatusText = computed(() => {
  switch (saveStatus.value) {
    case 'saving': return 'Saving…'
    case 'saved': return lastSavedAt.value ? `Saved · ${formatSavedTime(lastSavedAt.value)}` : 'Saved'
    case 'unsaved': return 'Unsaved — blur a field to save'
    case 'error': return 'Couldn’t save'
    default: return 'Auto-saves'
  }
})

function formatSavedTime (ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function splitLookbookPhrases (raw: string): string[] {
  return raw
    .split(/[·•|,;/;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length <= 48)
}

const traitTags = computed(() => {
  const fromPersonality = splitLookbookPhrases(form.personality)
  const fromRole = splitLookbookPhrases(form.roleDescription).slice(0, 2)
  const merged = [...fromRole, ...fromPersonality]
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of merged) {
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= 5) break
  }
  return out
})

const headerRoleLine = computed(() => {
  const role = form.roleDescription.trim()
  if (!role) return ''
  const first = role.split(/[.\n]/)[0]?.trim() || role
  return first.slice(0, 90) + (first.length > 90 ? '…' : '')
})

const roleShort = computed(() => {
  const role = form.roleDescription.trim()
  if (!role) return ''
  const first = role.split(/[.\n]/)[0]?.trim() || role
  return first.slice(0, 48) + (first.length > 48 ? '…' : '')
})

const signatureBullets = computed(() => {
  const raw = form.signatureDetails.trim()
  if (!raw) return [] as string[]
  const byLine = raw.split(/\n+/).map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
  if (byLine.length > 1) return byLine.slice(0, 8)
  return splitLookbookPhrases(raw).slice(0, 8)
})

const footerQuote = computed(() => {
  const personality = form.personality.trim()
  if (!personality) return ''
  const sentence = personality.split(/[.!?]/)[0]?.trim()
  if (!sentence || sentence.length > 120) return ''
  if (traitTags.value.length >= 2 && sentence.length < 20) return ''
  return sentence
})

watch(form, () => {
  if (!character.value || saveStatus.value === 'saving') return
  if (isDirty.value) {
    saveStatus.value = 'unsaved'
  } else if (saveStatus.value === 'unsaved') {
    saveStatus.value = lastSavedAt.value ? 'saved' : 'idle'
  }
}, { deep: true })

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
  ) {
    saveStatus.value = lastSavedAt.value ? 'saved' : 'idle'
    return
  }
  if (!payload.name) {
    form.name = c.name
    saveStatus.value = lastSavedAt.value ? 'saved' : 'idle'
    return
  }
  saveStatus.value = 'saving'
  try {
    if (synthetic.value) {
      const createdId = await createBackingCharacter(token, payload.name)
      if (!createdId) {
        saveStatus.value = 'error'
        return
      }
    }
    const res = await $fetch<{ character: CreativeCharacter }>(
      `/api/projects/${projectId.value}/characters/${effectiveCharacterId.value}`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: payload }
    )
    character.value = res.character
    synthetic.value = false
    syncForm(res.character)
    lastSavedAt.value = Date.now()
    saveStatus.value = 'saved'
  } catch (e: unknown) {
    saveStatus.value = 'error'
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
      /* best-effort relink */
    }
  }
  return newId
}

async function copyPrompt () {
  const t = lockedPortraitPrompt.value
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.showToast('Could not copy.', 'error')
  }
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
  const next = (expressionDraft[img.assetId] ?? '').trim()
  if (next === img.expressionLabel) return
  const token = getAuthToken()
  if (!token) return
  savingExpressionAssetId.value = img.assetId
  try {
    const asset = assets.value.find((a) => a.id === img.assetId)
    const meta = (asset?.metadata && typeof asset.metadata === 'object') ? { ...asset.metadata } : {}
    await $fetch(`/api/projects/${projectId.value}/assets/${img.assetId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        metadata: {
          ...meta,
          character_id: effectiveCharacterId.value,
          character_name: form.name,
          expression_label: next
        }
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
    for (const g of galleryImages.value) {
      const shouldFeature = g.assetId === img.assetId
      const asset = assets.value.find((a) => a.id === g.assetId)
      const meta = (asset?.metadata && typeof asset.metadata === 'object') ? { ...asset.metadata } : {}
      if ((meta.featured === true) === shouldFeature) continue
      await $fetch(`/api/projects/${projectId.value}/assets/${g.assetId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          metadata: {
            ...meta,
            character_id: effectiveCharacterId.value,
            character_name: form.name,
            featured: shouldFeature
          }
        }
      })
    }
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not set featured image'), 'error')
  } finally {
    featuringAssetId.value = ''
  }
}

async function deleteImage (img: GalleryImage) {
  if (!globalThis.confirm('Delete this reference photo?')) return
  const token = getAuthToken()
  if (!token) return
  deletingAssetId.value = img.assetId
  try {
    await $fetch(`/api/projects/${projectId.value}/assets/${img.assetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.showToast('Photo removed.', 'info')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not delete'), 'error')
  } finally {
    deletingAssetId.value = ''
  }
}

async function onReferenceClipPicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const token = getAuthToken()
  if (!token) return
  try {
    validateCharacterReferenceClipFile(file)
  } catch (e: unknown) {
    toast.showToast(e instanceof Error ? e.message : 'Invalid file', 'error')
    return
  }
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
    toast.showToast('Reference clip saved.', 'success')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not upload clip'), 'error')
  } finally {
    uploadingVoice.value = false
  }
}

async function deleteReferenceClip (assetId: string) {
  if (!globalThis.confirm('Remove this reference clip?')) return
  const token = getAuthToken()
  if (!token) return
  deletingAssetId.value = assetId
  try {
    await $fetch(`/api/projects/${projectId.value}/assets/${assetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.showToast('Clip removed.', 'info')
    await load()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not remove clip'), 'error')
  } finally {
    deletingAssetId.value = ''
  }
}

watch([projectId, characterId, nameHint], () => { void load() }, { immediate: true })

useHead({
  title: computed(() => (form.name ? `${form.name} · Cast` : 'Character')),
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
    }
  ]
})
</script>

<style scoped>
.lookbook-sheet {
  background: #141816;
  color: #e8e6e1;
}
.lookbook-sheet__atmosphere {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 20% 0%, rgba(65, 170, 168, 0.14), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(180, 120, 60, 0.08), transparent 50%),
    linear-gradient(180deg, #1a1f1c 0%, #101412 55%, #0c0e0d 100%);
  pointer-events: none;
}
.lookbook-sheet__atmosphere::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  pointer-events: none;
}
.lookbook-name {
  font-family: 'Bebas Neue', Impact, Haettenschweiler, sans-serif;
  font-size: clamp(2rem, 5vw, 3.25rem);
  letter-spacing: 0.04em;
  line-height: 1.05;
  text-transform: uppercase;
}
.lookbook-label {
  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(65, 170, 168, 0.85);
  margin-bottom: 0.35rem;
}
.lookbook-portrait__img {
  animation: lookbook-fade-in 0.7s ease-out both;
}
.lookbook-plate {
  animation: lookbook-fade-up 0.55s ease-out both;
}
.lookbook-plate:nth-child(1) { animation-delay: 0.05s; }
.lookbook-plate:nth-child(2) { animation-delay: 0.1s; }
.lookbook-plate:nth-child(3) { animation-delay: 0.15s; }
.lookbook-plate:nth-child(4) { animation-delay: 0.2s; }
.lookbook-plate:nth-child(5) { animation-delay: 0.25s; }
.lookbook-plate:nth-child(6) { animation-delay: 0.3s; }
@keyframes lookbook-fade-in {
  from { opacity: 0; transform: scale(1.02); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes lookbook-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.character-lookbook :deep(summary::-webkit-details-marker) {
  display: none;
}
</style>
