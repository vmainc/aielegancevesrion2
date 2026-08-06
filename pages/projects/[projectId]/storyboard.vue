<template>
  <div :class="isFullscreen ? 'fixed inset-0 z-40 bg-white overflow-y-auto p-4 sm:p-6' : 'max-w-6xl'">
    <div class="flex items-start justify-between gap-3 mb-6">
      <p class="text-sm text-gray-500">
        <span class="text-primary font-medium">Storyboard</span>
        <template v-if="builderMode">
          · Build this scene board-by-board. Add panels, fill in beats, then upload or generate frames.
          <NuxtLink to="/tools/storyboard-builder" class="text-primary font-medium hover:underline ml-1">
            Storyboard Builder
          </NuxtLink>
        </template>
        <template v-else>
          · Add boards manually per scene, or use panels from script import / project build. Use
          <span class="text-gray-700">Generate image</span>
          on each board (or <span class="text-gray-700">Generate all images</span>) to fill start and end frames — cast portraits are used when available. When both frames are ready,
          <span class="text-gray-700">Generate video</span> appears on the board.
        </template>
      </p>
      <button
        type="button"
        class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
        @click="isFullscreen = !isFullscreen"
      >
        {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
      </button>
    </div>

    <div
      v-if="!clientReady"
      class="rounded-xl border border-primary/20 bg-primary/5 px-6 py-10"
    >
      <FilmReelLoader
        size="md"
        label="Loading storyboard"
        sub-label="Preparing your workspace…"
      />
    </div>

    <template v-else>
      <div
        v-if="!isCloudProject"
        class="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-8 text-sm text-amber-900"
      >
        Shot generation saves to your cloud account. Open a project you created after signing in, or import a script from
        <NuxtLink to="/projects" class="underline font-medium text-primary">Projects</NuxtLink>.
      </div>

      <div
        v-else-if="!isAuthenticated"
        class="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-8 text-sm text-gray-700"
      >
        <NuxtLink to="/login" class="text-primary font-medium underline">Log in</NuxtLink>
        to load scenes and generate shots.
      </div>

      <div
        v-else-if="scenesLoadError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 mb-8 text-sm text-red-800"
      >
        {{ scenesLoadError }}
      </div>

      <div
        v-else-if="!scenes.length"
        class="rounded-xl border border-dashed border-gray-300 bg-gray-100 p-8 mb-8"
      >
        <h2 class="text-lg font-semibold text-gray-800 mb-2">No scenes yet</h2>
        <p class="text-sm text-gray-500 mb-6">
          <template v-if="builderMode">
            Start a scene from Storyboard Builder — it begins with one blank board.
          </template>
          <template v-else>
            Run director analysis on Overview, generate scenes on the Scenes tab, then return here to batch panels or generate shots per scene.
          </template>
        </p>
        <NuxtLink
          v-if="builderMode"
          to="/tools/storyboard-builder"
          class="inline-flex px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Open Storyboard Builder
        </NuxtLink>
        <NuxtLink
          v-else
          to="/projects"
          class="inline-flex px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Go to Projects
        </NuxtLink>
      </div>

      <div v-else class="space-y-8 mb-10">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <div class="flex-1 min-w-0">
              <label for="scene-pick" class="block text-sm font-medium text-gray-700 mb-2">Scene</label>
              <select
                id="scene-pick"
                v-model="selectedSceneId"
                class="w-full max-w-md px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary text-sm"
              >
                <option
                  v-for="(s, idx) in scenes"
                  :key="s.id"
                  :value="s.id"
                >
                  SCENE {{ idx + 1 }} — {{ s.heading }} ({{ scenePanelLabel(s) }})
                </option>
              </select>
              <p v-if="activeScene?.summary" class="mt-2 text-xs text-gray-500 line-clamp-2">
                {{ activeScene.summary }}
              </p>
              <p class="mt-1 text-xs text-gray-500">
                <template v-if="activeSceneShotCount > 0">
                  {{ activeSceneShotCount }} panel skeleton{{ activeSceneShotCount === 1 ? '' : 's' }} in this scene
                  ({{ activeSceneClipSeconds }}s at current clip lengths).
                </template>
                <template v-else-if="activeScenePanelEstimate">
                  Estimated output: {{ activeScenePanelEstimate }} for this scene.
                </template>
                <template v-else>
                  Estimated output: 5–12 panels for this scene.
                </template>
              </p>
              <p
                v-if="storyboardTimingWarning && !builderMode"
                class="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
              >
                {{ storyboardTimingWarning }}
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <button
                v-if="selectedSceneId && !shotsLoading"
                type="button"
                class="px-3 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-50"
                :disabled="addingBoard"
                @click="addBoard"
              >
                {{ addingBoard ? 'Adding…' : shots.length ? '+ Add board' : 'Add first board' }}
              </button>
              <div class="relative">
                <button
                  type="button"
                  class="h-10 w-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                  :aria-expanded="showImageSettings ? 'true' : 'false'"
                  aria-label="Image settings"
                  @click="showImageSettings = !showImageSettings"
                >
                  ⚙
                </button>
                <div
                  v-if="showImageSettings"
                  class="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-20"
                >
                  <label for="image-model-pick" class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Image model
                  </label>
                  <select
                    id="image-model-pick"
                    v-model="selectedImageModelId"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                    <option v-for="m in imageModelOptions" :key="m.id" :value="m.id">
                      {{ m.label }}
                    </option>
                  </select>
                  <p class="mt-2 text-xs text-gray-500">
                    <strong>Generate image</strong> fills each board’s start and end frames and saves to Assets → Storyboards.
                    Cast portraits from Assets → Characters are used when available. End frames continue the clip’s action from the start frame.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="shots.length && boardsMissingFrames > 0"
            class="mt-4 flex flex-wrap items-center gap-3"
          >
            <button
              type="button"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-45"
              :disabled="!!imageGenId || !shotsPersisted || generatingAllFrames"
              @click="generateAllFrames"
            >
              {{ generatingAllFrames ? 'Generating start & end frames…' : `Generate all images (${boardsMissingFrames})` }}
            </button>
            <p v-if="!shotsPersisted" class="text-xs text-amber-800">
              Save the shot list first (fix any warning above), then generate images.
            </p>
            <p v-else class="text-xs text-gray-500">
              Fills missing start and end frames so each board has a logical beginning and end for video.
            </p>
          </div>
          <p v-if="generateError" class="mt-3 text-sm text-red-600">{{ generateError }}</p>
        </div>

        <div
          v-if="shotsLoading"
          class="rounded-xl border border-primary/15 bg-gray-50 p-5"
        >
          <FilmReelLoader
            size="sm"
            label="Loading shots"
            sub-label="Fetching panels for the selected scene…"
          />
        </div>

        <div v-else-if="!shots.length" class="text-sm text-gray-500 space-y-4">
          <p>No panels for this scene yet.</p>
          <button
            type="button"
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 text-sm font-semibold rounded-lg disabled:opacity-50"
            :disabled="addingBoard"
            @click="addBoard"
          >
            {{ addingBoard ? 'Adding…' : 'Add first board' }}
          </button>
          <p class="text-xs text-gray-500 max-w-md">
            Each board is one storyboard panel — add a title, description, and production prompt, then upload or generate a frame.
            You can also build panels from the
            <NuxtLink :to="`/projects/${projectId}/director`" class="text-primary font-medium hover:underline">Director</NuxtLink>
            step or import a script on Overview.
          </p>
        </div>

        <div
          v-if="!shotsLoading && persistenceWarning"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ persistenceWarning }}
        </div>

        <div
          v-if="!shotsLoading && shots.length"
          class="flex flex-wrap items-center justify-between gap-2 mb-3"
        >
          <p class="text-xs text-gray-500">
            Drag a board by its grip handle and drop it onto another board to reorder. Use the dashed card to add a new board.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              @click="setAllBoardDetailsOpen(false)"
            >
              Collapse all details
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              @click="setAllBoardDetailsOpen(true)"
            >
              Expand all details
            </button>
          </div>
        </div>

        <ul v-if="!shotsLoading && shots.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <StoryboardBoardCard
            v-for="(shot, idx) in shots"
            :key="shot.id"
            :shot="shot"
            :index="idx"
            :shots-length="shots.length"
            :dragging-shot-id="draggingShotId"
            :drop-target-index="dropTargetIndex"
            :reordering="reordering"
            :armed-shot-id="armedShotId"
            :image-gen-id="imageGenId"
            :frame-uploading-id="frameUploadingId"
            :frame-deleting-id="frameDeletingId"
            :deleting-board-id="deletingBoardId"
            :generating-all-frames="generatingAllFrames"
            :opening-video-shot-id="openingVideoShotId"
            :frame-preview-box-class="framePreviewBoxClass"
            :frame-preview-loading="framePreviewLoading"
            :frame-preview-failed="framePreviewFailed"
            :frame-bible-debug="frameBibleDebug"
            :active-image-model-label="activeImageModelLabel"
            :panel-image-src="panelImageSrc"
            :has-displayable-frame="hasDisplayableFrame"
            :has-any-displayable-frame="hasAnyDisplayableFrame"
            :can-generate-frame="canGenerateFrame"
            :is-slot-busy="isSlotBusy"
            :frame-slot-key="frameSlotKey"
            :shot-character-matches="shotCharacterMatches"
            :character-profile-to="characterProfileTo"
            :board-details-open-for="boardDetailsOpenFor"
            :on-board-drag-start="onBoardDragStart"
            :on-board-drag-end="onBoardDragEnd"
            :on-drop-slot-drag-over="onDropSlotDragOver"
            :on-drop-slot-drag-leave="onDropSlotDragLeave"
            :on-drop-at-slot="onDropAtSlot"
            :on-grip-press="onGripPress"
            :on-delete-board="deleteBoard"
            :on-open-frame-preview="openFramePreview"
            :on-frame-preview-img-error="onFramePreviewImgError"
            :on-trigger-storyboard-upload="triggerStoryboardUpload"
            :on-generate-frame="generateFrame"
            :on-clear-storyboard-frame="clearStoryboardFrame"
            :on-generate-video="openVideoGenerationForBoard"
            :on-board-details-toggle="onBoardDetailsToggle"
            :on-save-shot="saveShot"
          />
          <StoryboardAddBoardCard
            :shots-length="shots.length"
            :dragging-shot-id="draggingShotId"
            :drop-target-index="dropTargetIndex"
            :reordering="reordering"
            :adding-board="addingBoard"
            :on-drop-slot-drag-over="onDropSlotDragOver"
            :on-drop-slot-drag-leave="onDropSlotDragLeave"
            :on-drop-at-slot="onDropAtSlot"
            :on-add-board-card-click="onAddBoardCardClick"
          />
        </ul>

        <div
          v-if="!shotsLoading && selectedSceneId && shots.length"
          class="flex flex-wrap items-center gap-3 pt-2"
        >
          <button
            type="button"
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded-lg disabled:opacity-50"
            :disabled="addingBoard || reordering"
            @click="addBoard()"
          >
            {{ addingBoard ? 'Adding board…' : '+ Add board' }}
          </button>
        </div>
      </div>

      <div class="pt-8 border-t border-gray-200 flex flex-wrap gap-4">
        <NuxtLink
          v-if="builderMode"
          to="/tools/storyboard-builder"
          class="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Storyboard Builder
        </NuxtLink>
        <NuxtLink
          v-else
          :to="`/projects/${projectId}/scenes`"
          class="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Scenes
        </NuxtLink>
        <NuxtLink
          to="/assets/video"
          class="text-sm text-primary font-medium hover:underline"
        >
          Saved clips →
        </NuxtLink>
      </div>
    <input
      ref="storyboardFrameFileInput"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      @change="onStoryboardFrameFilePicked"
    >

    <StoryboardFramePreviewDialog
      :frame="expandedFrame"
      @close="closeFramePreview"
    />

    </template>
  </div>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectAsset } from '~/types/project-asset'
import {
  CHARACTER_CREATOR_IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID
} from '~/lib/character-creator-models'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { canonicalizeShotCastNames } from '~/lib/cast-name-convention'
import {
  collectCharacterPortraitUrls,
  findCharactersInShot,
  projectCharacterRefToCastMember,
  resolveCharactersForFrameGeneration,
  type ProjectCharacterRef
} from '~/lib/shot-character-continuity'
import {
  buildMotionPromptForShot,
  mergeLegacyShotPromptsToUnified,
  resolveFrameGenerationPrompt
} from '~/lib/unified-shot-prompt'
import { prepareImageFileForUpload } from '~/lib/image-blob-client'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  normalizeStoryboardFrameImageUrl,
  storyboardFramePreviewClasses
} from '~/lib/storyboard-frame-image'
import {
  mapStoryboardFrameAssetsToShots,
  storyboardFrameMetadata
} from '~/lib/storyboard-panel-assets'
import {
  storyboardFrameSlotKey,
  type StoryboardFrameRole
} from '~/lib/storyboard-frame-role'
import {
  applyStoryboardFrameRoleToPrompt,
  shotMissingStoryboardFrame
} from '~/lib/storyboard-end-frame-prompt'
import {
  navigateToVideoGenerationFromPanel,
  type VideoGenerationPrefill
} from '~/lib/video-generation-prefill'
import {
  mergeProductionBibleGenerationOptions,
  productionBibleGenerationDebugLabel
} from '~/lib/production-bible-generation-context'
import {
  buildGenerationObservability,
  GENERATION_PATH,
  mergeGenerationObservabilityIntoMetadata
} from '~/lib/generation-observability'
import type { ProductionBibleResolvedContext } from '~/types/production-bible-context'
import {
  fetchImageAsDataUrl,
  isDirectStoryboardFrameSrc
} from '~/lib/storyboard-frame-preview-url'
import {
  appendPlaybackAccessToken,
  isProjectAssetMediaPath,
  projectAssetMediaPathOnly,
  projectAssetPlaybackSrc
} from '~/lib/project-asset-playback-url'
import { isCloudProjectId } from '~/composables/useCreativeProject'
import StoryboardBoardCard from '~/components/storyboard/StoryboardBoardCard.vue'
import StoryboardAddBoardCard from '~/components/storyboard/StoryboardAddBoardCard.vue'
import StoryboardFramePreviewDialog from '~/components/storyboard/StoryboardFramePreviewDialog.vue'

const {
  activeProject,
  activeProjectId,
  clientReady,
  loadServerProjects
} = useCreativeProject()
const { isAuthenticated, getAuthToken } = useAuth()
const toast = useToast()
const route = useRoute()

const builderMode = computed(() => route.query.builder === '1')

const projectId = activeProjectId
const project = activeProject
const isCloudProject = computed(() => isCloudProjectId(projectId.value || ''))

const { refs: characterRefs, reload: reloadCharacterRefs } = useProjectCharacterRefs(projectId)
const productionBible = useProductionBible(projectId)
const frameBibleDebug = reactive<Record<string, string>>({})
const frameGenerationProvenance = reactive<Record<string, {
  bibleContext: ProductionBibleResolvedContext | null
  promptForHash: string
}>>({})
const storyboardAssets = ref<ProjectAsset[]>([])
const shots = ref<CreativeShot[]>([])
const shotsLoading = ref(false)

const {
  scenes,
  selectedSceneId,
  scenesLoadError,
  loadScenes,
  activeScene,
  activeSceneShotCount,
  activeSceneClipSeconds,
  activeScenePanelEstimate,
  storyboardTimingWarning,
  scenePanelLabel
} = useStoryboardScene({
  projectId,
  project,
  clientReady,
  isAuthenticated,
  isCloudProject,
  shots,
  shotsLoading,
  getAuthToken
})

const shotStoryboardFramesMap = computed(() => {
  const sid = selectedSceneId.value
  if (!sid || !shots.value.length) return new Map()
  return mapStoryboardFrameAssetsToShots(shots.value, storyboardAssets.value, sid)
})

const generatingAllFrames = ref(false)
const openingVideoShotId = ref<string | null>(null)
const generateError = ref('')
const persistenceWarning = ref('')
const shotsPersisted = ref(true)
const imageGenId = ref<string | null>(null)
const framePreview = reactive<Record<string, string>>({})
const framePreviewFailed = reactive<Record<string, boolean>>({})
const framePreviewLoading = reactive<Record<string, boolean>>({})
const framePreviewHydrateAttempts = reactive<Record<string, number>>({})
const expandedFrame = ref<{ url: string; title: string; downloadUrl: string } | null>(null)
const framePreviewDialogEl = ref<HTMLElement | null>(null)
const frameDeletingId = ref<string | null>(null)
const frameUploadingId = ref<string | null>(null)
const addingBoard = ref(false)
const deletingBoardId = ref<string | null>(null)
const savingShotId = ref<string | null>(null)
/** Per-board accordion; unset = collapsed so frames align in the grid. */
const boardDetailsOpenByShotId = ref<Record<string, boolean>>({})
const storyboardFrameFileInput = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<{ shot: CreativeShot; role: StoryboardFrameRole } | null>(null)
const isFullscreen = ref(false)
const showImageSettings = ref(false)
const imageModelOptions = CHARACTER_CREATOR_IMAGE_MODELS
const selectedImageModelId = ref<string>(DEFAULT_IMAGE_MODEL_ID)
const activeImageModelLabel = computed(
  () => imageModelOptions.find(m => m.id === selectedImageModelId.value)?.label || selectedImageModelId.value
)

const {
  draggingShotId,
  dropTargetIndex,
  reordering,
  armedShotId,
  armBoardDrag,
  onBoardDragStart,
  onBoardDragEnd,
  onDropSlotDragOver,
  onDropSlotDragLeave,
  onDropAtSlot,
  persistShotOrder
} = useStoryboardBoardReorder({
  projectId,
  sceneId: selectedSceneId,
  shots,
  getAuthToken,
  toast
})

function onGripPress (shotId: string) {
  if (reordering.value || imageGenId.value || frameUploadingId.value) return
  armBoardDrag(shotId)
}

const framePreviewBoxClass = computed(() => {
  const base = storyboardFramePreviewClasses(project.value?.aspectRatio)
  return base
    .replace('max-w-[min(100%,300px)]', 'max-w-none')
    .replace(/\bmx-auto\b/g, '')
})

const boardsMissingFrames = computed(() =>
  shots.value.filter(s =>
    shotMissingStoryboardFrame(hasDisplayableFrame(s, 'start'), hasDisplayableFrame(s, 'end'))
  ).length
)

function shotCharacterMatches (shot: CreativeShot) {
  return findCharactersInShot(shot, characterRefs.value, activeScene.value?.summary)
}

function characterProfileTo (c: ProjectCharacterRef): string {
  const pid = projectId.value
  if (!pid || !c.id) return '#'
  const q = c.name ? `?name=${encodeURIComponent(c.name)}` : ''
  return `/projects/${pid}/cast/${c.id}${q}`
}

function applyCastNameConventionToShots (list: CreativeShot[]): CreativeShot[] {
  const cast = characterRefs.value
  if (!cast.length) return list
  return list.map((s) => {
    const c = canonicalizeShotCastNames(s, cast)
    return {
      ...s,
      title: c.title ?? s.title,
      description: c.description ?? s.description,
      imagePrompt: c.imagePrompt ?? s.imagePrompt,
      videoPrompt: c.videoPrompt ?? s.videoPrompt
    }
  })
}

function priorStoryboardFrameInScene (shot: CreativeShot): string | null {
  const idx = shots.value.findIndex(s => s.id === shot.id)
  if (idx <= 0) return null
  for (let i = idx - 1; i >= 0; i--) {
    const src = panelImageSrc(shots.value[i]!, 'start')
    if (src) return src
  }
  return null
}

function frameGenerationReferenceUrls (shot: CreativeShot, role: StoryboardFrameRole): string[] {
  const castInScope = resolveCharactersForFrameGeneration(
    shot,
    characterRefs.value,
    activeScene.value?.summary
  )
  const startSrc = role === 'end' ? panelImageSrc(shot, 'start') : null
  const prior = priorStoryboardFrameInScene(shot)
  const reserved =
    (startSrc ? 1 : 0) +
    (prior && prior !== startSrc ? 1 : 0)
  const plateBudget = Math.max(1, 4 - reserved)
  const urls = collectCharacterPortraitUrls(castInScope, plateBudget)
  if (prior && !urls.includes(prior) && urls.length < 4) {
    urls.push(prior)
  }
  if (startSrc && !urls.includes(startSrc) && urls.length < 4) {
    urls.unshift(startSrc)
  }
  return urls.slice(0, 4)
}

function frameSlotKey (shot: CreativeShot, role: StoryboardFrameRole): string {
  return storyboardFrameSlotKey(shot.id, role)
}

function isSlotBusy (shot: CreativeShot, role: StoryboardFrameRole): boolean {
  const key = frameSlotKey(shot, role)
  return imageGenId.value === key || frameUploadingId.value === key
}

function canGenerateFrame (shot: CreativeShot, _role: StoryboardFrameRole): boolean {
  return Boolean((shot.imagePrompt || shot.description || '').trim())
}

function hasAnyDisplayableFrame (shot: CreativeShot): boolean {
  return hasDisplayableFrame(shot, 'start') || hasDisplayableFrame(shot, 'end')
}

function panelIndexForShot (shot: CreativeShot): number {
  const idx = shots.value.findIndex(s => s.id === shot.id)
  return idx >= 0 ? idx : 0
}

function firstImageUrl (urls: unknown[]): string {
  for (const u of urls) {
    if (typeof u === 'string' && u.trim()) return u.trim()
    if (u && typeof u === 'object' && u !== null && 'url' in u) {
      const url = (u as { url: unknown }).url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
  }
  return ''
}

/** Same playback URL logic as Assets → Storyboards (proven to work in production). */
function assetPlaybackUrl (asset: ProjectAsset): string {
  const fileUrl = (asset.fileUrl || '').trim()
  if (fileUrl.startsWith('/pb/')) return fileUrl
  const pid = asset.projectId || projectId.value
  if (asset.id && pid) {
    return projectAssetPlaybackSrc({ ...asset, projectId: pid }, getAuthToken())
  }
  return fileUrl
}

function setPanelPreviewFromAsset (shotId: string, asset: ProjectAsset, role: StoryboardFrameRole) {
  const url = assetPlaybackUrl(asset)
  if (!url) return
  const key = storyboardFrameSlotKey(shotId, role)
  framePreview[key] = url
  framePreviewFailed[key] = false
  framePreviewHydrateAttempts[key] = 0
  collapseBoardDetails(shotId)
}

/** URL for <img src> — cached preview, else linked library asset. */
function panelImageSrc (shot: CreativeShot, role: StoryboardFrameRole = 'start'): string {
  const key = frameSlotKey(shot, role)
  if (framePreviewFailed[key]) return ''
  const cached = (framePreview[key] || '').trim()
  if (cached) return cached
  const hit = storyboardAssetForShot(shot, role)
  if (hit) return assetPlaybackUrl(hit)
  return ''
}

async function onFramePreviewImgError (shot: CreativeShot, role: StoryboardFrameRole = 'start') {
  const key = frameSlotKey(shot, role)
  const attempts = (framePreviewHydrateAttempts[key] || 0) + 1
  framePreviewHydrateAttempts[key] = attempts
  if (attempts > 1) {
    framePreviewFailed[key] = true
    return
  }
  const hit = storyboardAssetForShot(shot, role)
  const raw = hit ? assetPlaybackUrl(hit) : (framePreview[key] || '').trim()
  if (!raw) {
    framePreviewFailed[key] = true
    return
  }
  framePreviewLoading[key] = true
  try {
    const headers = await authHeaders()
    const dataUrl = await fetchImageAsDataUrl(raw, { headers: headers ?? undefined })
    framePreview[key] = dataUrl
    framePreviewFailed[key] = false
  } catch {
    framePreviewFailed[key] = true
  } finally {
    framePreviewLoading[key] = false
  }
}

async function setFramePreviewFromUrl (shotId: string, rawUrl: string) {
  const aspect = project.value?.aspectRatio || '16:9'
  const u = rawUrl.trim()
  if (!u) return
  framePreviewFailed[shotId] = false

  let displayUrl = u
  const pathOnly = projectAssetMediaPathOnly(u)
  if (isProjectAssetMediaPath(pathOnly) && !/[?&]access_token=/.test(u)) {
    displayUrl = appendPlaybackAccessToken(u.split('#')[0] || pathOnly, getAuthToken())
  }

  if (isDirectStoryboardFrameSrc(displayUrl)) {
    framePreview[shotId] = displayUrl
    return
  }

  if (u.startsWith('data:image/')) {
    try {
      framePreview[shotId] = await normalizeStoryboardFrameImageUrl(u, aspect)
    } catch {
      framePreview[shotId] = u
    }
    return
  }

  const headers = await authHeaders()
  try {
    const dataUrl = await fetchImageAsDataUrl(u, { headers: headers ?? undefined })
    try {
      framePreview[shotId] = await normalizeStoryboardFrameImageUrl(dataUrl, aspect)
    } catch {
      framePreview[shotId] = dataUrl
    }
  } catch {
    framePreview[shotId] = displayUrl || u
    framePreviewFailed[shotId] = false
  }
}


function unifiedPromptContext () {
  return {
    director: project.value?.director,
    continuityMemory: project.value?.continuityMemory,
    aspectRatio: project.value?.aspectRatio,
    sceneTitle: activeScene.value?.heading,
    sceneSummary: activeScene.value?.summary,
    cast: characterRefs.value.map(c => projectCharacterRefToCastMember(c))
  }
}

async function loadBibleContextForFrame (shot: CreativeShot) {
  const matches = shotCharacterMatches(shot)
  const characterIds = [
    ...new Set([...matches.map(c => c.id), ...characterRefs.value.map(c => c.id)])
  ].filter(Boolean)
  return productionBible.loadContextForPrompt(
    mergeProductionBibleGenerationOptions({
      sceneId: selectedSceneId.value || undefined,
      shotId: shot.id,
      characterIds
    })
  )
}

async function generateAllFrames () {
  if (!shotsPersisted.value) {
    toast.showToast('Shot list is not saved yet — rebuild from Director or fix the warning above.', 'error')
    return
  }
  const needsWork = shots.value.filter(s =>
    shotMissingStoryboardFrame(hasDisplayableFrame(s, 'start'), hasDisplayableFrame(s, 'end'))
  )
  if (!needsWork.length) {
    toast.showToast('All boards already have start and end frames.', 'info')
    return
  }
  generatingAllFrames.value = true
  let ok = 0
  let failed = 0
  try {
    // Start frames first across boards, then ends (ends use start as reference).
    for (const shot of needsWork) {
      if (hasDisplayableFrame(shot, 'start')) continue
      try {
        await generateFrame(shot, 'start', { quiet: true })
        if (hasDisplayableFrame(shot, 'start')) ok++
        else failed++
      } catch {
        failed++
      }
    }
    for (const shot of shots.value) {
      if (!hasDisplayableFrame(shot, 'start') || hasDisplayableFrame(shot, 'end')) continue
      try {
        await generateFrame(shot, 'end', { quiet: true })
        if (hasDisplayableFrame(shot, 'end')) ok++
        else failed++
      } catch {
        failed++
      }
    }
    if (ok && !failed) {
      toast.showToast(`Generated ${ok} frame(s) (start + end).`, 'success')
    } else if (ok) {
      toast.showToast(`Generated ${ok} frame(s); ${failed} failed.`, 'info')
    } else {
      toast.showToast('Could not generate frames. Check prompts and try one board at a time.', 'error')
    }
  } finally {
    generatingAllFrames.value = false
    imageGenId.value = null
  }
}

async function generateFrame (
  shot: CreativeShot,
  role: StoryboardFrameRole = 'start',
  opts?: { quiet?: boolean }
) {
  const quiet = Boolean(opts?.quiet)
  const basePrompt = (shot.imagePrompt || shot.description || '').trim()
  if (!basePrompt) {
    if (!quiet) toast.showToast('Add a production prompt or story beat first.', 'info')
    return
  }
  const slotKey = frameSlotKey(shot, role)
  const matches = shotCharacterMatches(shot)
  const panelIndex = shots.value.findIndex(s => s.id === shot.id)
  const productionBibleCtx = await loadBibleContextForFrame(shot)
  frameBibleDebug[shot.id] = productionBibleGenerationDebugLabel(productionBibleCtx)
  let prompt = resolveFrameGenerationPrompt(shot, {
    ...unifiedPromptContext(),
    panelIndex: panelIndex >= 0 ? panelIndex : undefined,
    productionBible: productionBibleCtx
  })
  prompt = applyStoryboardFrameRoleToPrompt(prompt, role, shot)
  frameGenerationProvenance[slotKey] = {
    bibleContext: productionBibleCtx,
    promptForHash: prompt
  }
  const referenceImageUrls = frameGenerationReferenceUrls(shot, role)
  if (!referenceImageUrls.length && !quiet) {
    const missingPortraits = characterRefs.value.filter(c => !c.portraitUrl?.trim() && !(c.plateUrls || []).length)
    if (missingPortraits.length) {
      toast.showToast(
        'No cast plates attached — add reference plates on the character lookbook (or Assets → Characters) for consistent looks.',
        'info'
      )
    }
  }
  const token = getAuthToken()
  if (!token) {
    if (!quiet) toast.showToast('Sign in to generate frames.', 'warning')
    return
  }
  imageGenId.value = slotKey
  try {
    const res = await $fetch<{ urls?: unknown[] }>('/api/generate/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        prompt,
        model: selectedImageModelId.value,
        referenceImageUrls,
        referenceImageUrl: referenceImageUrls[0],
        aspectRatio: project.value?.aspectRatio || '16:9'
      }
    })
    const url = firstImageUrl(res.urls || [])
    if (url) {
      framePreviewFailed[slotKey] = false
      const saveErr = await autoSaveGeneratedFrame(shot, url, matches, role)
      if (!saveErr) {
        if (!quiet) {
          toast.showToast(`${role === 'end' ? 'End' : 'Start'} frame generated and saved.`, 'success')
        }
      } else {
        framePreview[slotKey] = url
        framePreviewFailed[slotKey] = false
        if (!quiet) {
          toast.showToast(`Frame generated (save failed): ${saveErr}`, 'warning')
        }
      }
    } else if (!quiet) {
      toast.showToast('No image returned.', 'error')
    }
  } catch (e: unknown) {
    if (!quiet) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message || 'Image generation failed')
          : 'Image generation failed'
      toast.showToast(msg, 'error')
    } else {
      throw e instanceof Error ? e : new Error('Image generation failed')
    }
  } finally {
    if (!generatingAllFrames.value) imageGenId.value = null
  }
}

async function openVideoGenerationForBoard (shot: CreativeShot) {
  if (!hasDisplayableFrame(shot, 'start') || !hasDisplayableFrame(shot, 'end')) {
    toast.showToast('Add both a start and end frame before generating video.', 'info')
    return
  }
  const pid = projectId.value
  const sceneId = selectedSceneId.value
  if (!pid || !isCloudProjectId(pid) || !sceneId) {
    toast.showToast('Save this project to the cloud before generating video.', 'info')
    return
  }
  const headers = await authHeaders()
  if (!headers) {
    toast.showToast('Sign in to generate video for this board.', 'info')
    return
  }

  openingVideoShotId.value = shot.id
  try {
    const prefill = await $fetch<VideoGenerationPrefill>(
      `/api/projects/${pid}/video-panel-prefill`,
      {
        query: { sceneId, shotId: shot.id },
        headers
      }
    )
    await navigateToVideoGenerationFromPanel({
      projectId: pid,
      sceneId,
      shotId: shot.id,
      prefill
    })
  } catch (e: unknown) {
    toast.showToast(
      formatApiFetchError(e, 'Could not open video generation for this board.'),
      'error'
    )
  } finally {
    if (openingVideoShotId.value === shot.id) openingVideoShotId.value = null
  }
}

function hasDisplayableFrame (shot: CreativeShot, role: StoryboardFrameRole = 'start'): boolean {
  return Boolean(panelImageSrc(shot, role))
}

function boardDetailsOpenFor (shot: CreativeShot): boolean {
  return boardDetailsOpenByShotId.value[shot.id] ?? false
}

function onBoardDetailsToggle (e: Event, shot: CreativeShot) {
  const el = e.target as HTMLDetailsElement
  boardDetailsOpenByShotId.value = {
    ...boardDetailsOpenByShotId.value,
    [shot.id]: el.open
  }
}

function setAllBoardDetailsOpen (open: boolean) {
  const next: Record<string, boolean> = { ...boardDetailsOpenByShotId.value }
  for (const shot of shots.value) {
    next[shot.id] = open
  }
  boardDetailsOpenByShotId.value = next
}

function collapseBoardDetails (shotId: string) {
  boardDetailsOpenByShotId.value = {
    ...boardDetailsOpenByShotId.value,
    [shotId]: false
  }
}

function storyboardAssetForShot (shot: CreativeShot, role: StoryboardFrameRole = 'start'): ProjectAsset | null {
  return shotStoryboardFramesMap.value.get(shot.id)?.[role] ?? null
}

function openFramePreview (shot: CreativeShot, role: StoryboardFrameRole = 'start') {
  const url = panelImageSrc(shot, role)
  if (!url) return
  const roleLabel = role === 'end' ? 'End frame' : 'Start frame'
  expandedFrame.value = {
    url,
    title: `${shot.title || 'Storyboard'} — ${roleLabel}`,
    downloadUrl: url
  }
  void nextTick(() => framePreviewDialogEl.value?.focus())
}

function closeFramePreview () {
  expandedFrame.value = null
}

async function clearStoryboardFrame (shot: CreativeShot, role: StoryboardFrameRole = 'start') {
  const roleLabel = role === 'end' ? 'end' : 'start'
  const label = shot.title || 'this board'
  if (!confirm(`Remove the ${roleLabel} frame for “${label}”?`)) return
  const pid = projectId.value
  const token = getAuthToken()
  const slotKey = frameSlotKey(shot, role)
  frameDeletingId.value = slotKey
  try {
    const asset = storyboardAssetForShot(shot, role)
    if (asset && pid && token) {
      await $fetch(`/api/projects/${pid}/assets/${asset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      storyboardAssets.value = storyboardAssets.value.filter(a => a.id !== asset.id)
    }
    const previewUrl = framePreview[slotKey]
    delete framePreview[slotKey]
    delete framePreviewFailed[slotKey]
    if (expandedFrame.value?.url === previewUrl) {
      closeFramePreview()
    }
    toast.showToast(`${role === 'end' ? 'End' : 'Start'} frame removed.`, 'success')
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not remove frame')
    toast.showToast(msg, 'error')
  } finally {
    frameDeletingId.value = null
  }
}

function applySavedFramesForCurrentScene () {
  for (const s of shots.value) {
    for (const role of ['start', 'end'] as const) {
      const hit = storyboardAssetForShot(s, role)
      if (hit) setPanelPreviewFromAsset(s.id, hit, role)
    }
  }
}

function triggerStoryboardUpload (shot: CreativeShot, role: StoryboardFrameRole = 'start') {
  uploadTarget.value = { shot, role }
  storyboardFrameFileInput.value?.click()
}

async function onStoryboardFrameFilePicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const target = uploadTarget.value
  uploadTarget.value = null
  if (!file || !target) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  await uploadStoryboardFrame(target.shot, file, target.role)
}

async function uploadStoryboardFrame (shot: CreativeShot, file: File, role: StoryboardFrameRole = 'start') {
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Log in to upload frames.', 'info')
    return
  }
  const slotKey = frameSlotKey(shot, role)
  frameUploadingId.value = slotKey
  framePreviewFailed[slotKey] = false
  let localBlobUrl: string | null = null
  try {
    const matches = shotCharacterMatches(shot)
    const existing = storyboardAssetForShot(shot, role)
    if (existing?.id) {
      await $fetch(`/api/projects/${id}/assets/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      storyboardAssets.value = storyboardAssets.value.filter(a => a.id !== existing.id)
      delete framePreview[slotKey]
    }
    const uploadFile = await prepareImageFileForUpload(file)
    localBlobUrl = URL.createObjectURL(uploadFile)
    framePreview[slotKey] = localBlobUrl
    const roleSuffix = role === 'end' ? ' — End frame' : ''
    const fd = new FormData()
    fd.append('kind', 'storyboard')
    fd.append('title', `${shot.title || 'Storyboard Frame'}${roleSuffix} (uploaded)`.slice(0, 500))
    fd.append('notes', role === 'end' ? 'Uploaded storyboard end frame' : 'Uploaded storyboard frame')
    fd.append(
      'metadata',
      JSON.stringify(
        storyboardFrameMetadata(shot, sid, panelIndexForShot(shot), {
          frame_role: role,
          source: 'storyboard_upload',
          character_ids: matches.map(c => c.id),
          character_names: matches.map(c => c.name)
        })
      )
    )
    fd.append('file', uploadFile)
    const out = await $fetch<{ asset?: ProjectAsset }>(`/api/projects/${id}/assets/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    })
    if (out.asset?.id) {
      const saved = { ...out.asset, projectId: out.asset.projectId || id }
      storyboardAssets.value = [saved, ...storyboardAssets.value.filter(a => a.id !== saved.id)]
      setPanelPreviewFromAsset(shot.id, saved, role)
      await loadStoryboardAssets()
      const linked = storyboardAssetForShot(shot, role) || saved
      setPanelPreviewFromAsset(shot.id, linked, role)
      toast.showToast(`${role === 'end' ? 'End' : 'Start'} frame uploaded.`, 'success')
    } else {
      toast.showToast('Upload finished but no asset was returned.', 'warning')
    }
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not upload frame'), 'error')
  } finally {
    if (localBlobUrl) URL.revokeObjectURL(localBlobUrl)
    frameUploadingId.value = null
  }
}

async function loadStoryboardAssets () {
  const id = projectId.value
  if (!id || !isCloudProjectId(id)) return
  const headers = await authHeaders()
  if (!headers) return
  try {
    const [projectRes, myRes] = await Promise.all([
      $fetch<{ items: ProjectAsset[] }>(`/api/projects/${id}/assets?kind=storyboard`, { headers }).catch(
        () => ({ items: [] as ProjectAsset[] })
      ),
      $fetch<{ items: ProjectAsset[] }>('/api/assets/my?kind=storyboard', { headers }).catch(
        () => ({ items: [] as ProjectAsset[] })
      )
    ])
    const byId = new Map<string, ProjectAsset>()
    for (const a of projectRes.items || []) {
      if (a.id) byId.set(a.id, a)
    }
    for (const a of myRes.items || []) {
      if (a.id && a.projectId === id && !byId.has(a.id)) byId.set(a.id, a)
    }
    storyboardAssets.value = [...byId.values()].sort((a, b) =>
      String(b.updated || b.created).localeCompare(String(a.updated || a.created))
    )
  } catch {
    storyboardAssets.value = []
  }
}

async function imageUrlToBlob (url: string): Promise<Blob> {
  if (url.startsWith('data:image/')) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Could not read generated image data')
    return res.blob()
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download generated image (HTTP ${res.status})`)
  return res.blob()
}

async function removeStoryboardAssetForShot (shot: CreativeShot, role: StoryboardFrameRole = 'start') {
  const existing = storyboardAssetForShot(shot, role)
  const pid = projectId.value
  const token = getAuthToken()
  if (!existing?.id || !pid || !token) return
  try {
    await $fetch(`/api/projects/${pid}/assets/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    storyboardAssets.value = storyboardAssets.value.filter(a => a.id !== existing.id)
  } catch {
    /* replace even if delete fails */
  }
}

async function persistStoryboardAsset (
  shot: CreativeShot,
  imageUrl: string,
  matches: ReturnType<typeof shotCharacterMatches>,
  role: StoryboardFrameRole = 'start'
): Promise<ProjectAsset | null> {
  const id = projectId.value
  const sid = selectedSceneId.value
  const token = getAuthToken()
  if (!id || !sid || !token) return null

  const roleSuffix = role === 'end' ? ' — End' : ''
  const title = `${shot.title || 'Storyboard Frame'}${roleSuffix} (${activeImageModelLabel.value})`.slice(0, 500)
  const slotKey = frameSlotKey(shot, role)
  const prov = frameGenerationProvenance[slotKey]
  const baseMetadata = storyboardFrameMetadata(shot, sid, panelIndexForShot(shot), {
    frame_role: role,
    model_id: selectedImageModelId.value,
    model_label: activeImageModelLabel.value,
    character_ids: matches.map(c => c.id),
    character_names: matches.map(c => c.name)
  })
  const metadata = mergeGenerationObservabilityIntoMetadata(
    baseMetadata,
    buildGenerationObservability({
      generationPath: GENERATION_PATH.STORYBOARD_FRAME,
      projectId: id,
      sceneId: sid,
      shotId: shot.id,
      characterIds: matches.map(c => c.id),
      model: selectedImageModelId.value,
      provider: 'openrouter',
      promptForHash: prov?.promptForHash,
      bibleContext: prov?.bibleContext ?? null
    })
  )

  if (/^https?:\/\//i.test(imageUrl)) {
    const out = await $fetch<{ asset?: ProjectAsset }>(
      `/api/projects/${id}/assets/ingest-from-url`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: {
          url: imageUrl,
          kind: 'storyboard',
          title,
          notes: 'Auto-saved generated frame',
          metadata
        }
      }
    )
    return out.asset ?? null
  }

  if (!imageUrl.startsWith('data:image/')) return null

  const blob = await imageUrlToBlob(imageUrl)
  const compressedBlob = await maybeCompressImageBlob(blob)
  const uploadFile = await prepareImageFileForUpload(
    new File(
      [compressedBlob],
      `frame_${shot.sortOrder || 0}.${compressedBlob.type.includes('png') ? 'png' : 'jpg'}`,
      { type: compressedBlob.type || 'image/jpeg' }
    )
  )
  const fd = new FormData()
  fd.append('kind', 'storyboard')
  fd.append('title', title)
  fd.append('notes', 'Auto-saved generated frame')
  fd.append('metadata', JSON.stringify(metadata))
  fd.append('file', uploadFile)
  const out = await $fetch<{ asset?: ProjectAsset }>(`/api/projects/${id}/assets/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  })
  return out.asset ?? null
}

async function autoSaveGeneratedFrame (
  shot: CreativeShot,
  imageUrl: string,
  matches: ReturnType<typeof shotCharacterMatches>,
  role: StoryboardFrameRole = 'start'
): Promise<string | null> {
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return 'missing project or scene id'
  const token = getAuthToken()
  if (!token) return 'not authenticated'
  if (!shotsPersisted.value && !shot.id.trim()) {
    return 'Shot list was not saved to the cloud — rebuild from Director (fix any warning above), then generate images.'
  }
  const src = (imageUrl || '').trim()
  if (!src) return 'no image data to save'
  try {
    await removeStoryboardAssetForShot(shot, role)
    const asset = await persistStoryboardAsset(shot, src, matches, role)
    if (asset?.id) {
      storyboardAssets.value = [asset, ...storyboardAssets.value.filter(a => a.id !== asset.id)]
      await loadStoryboardAssets()
      const linked = storyboardAssetForShot(shot, role) || asset
      setPanelPreviewFromAsset(shot.id, linked, role)
      return null
    }
    return 'could not save frame to project library'
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'data' in e) {
      const msg = String((e as { data?: { message?: string } }).data?.message || '').trim()
      if (msg) return msg
    }
    if (e instanceof Error && e.message.trim()) return e.message.trim()
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0
    if (status === 413) {
      return 'Image file is too large for the server. Try Flux Klein or a smaller export.'
    }
    return 'unknown upload error'
  }
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

async function authHeaders () {
  const token = getAuthToken()
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

async function saveShot (shot: CreativeShot) {
  const id = projectId.value
  const sid = selectedSceneId.value
  const token = getAuthToken()
  if (!id || !sid || !token || !shot.id) return
  savingShotId.value = shot.id
  try {
    await $fetch(`/api/projects/${id}/scenes/${sid}/shots/${shot.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        title: shot.title,
        description: shot.description,
        shotType: shot.shotType,
        cameraMove: shot.cameraMove,
        durationSeconds: shot.durationSeconds,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        negativePrompt: shot.negativePrompt
      }
    })
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not save board'), 'error')
  } finally {
    if (savingShotId.value === shot.id) savingShotId.value = null
  }
}

async function addBoard (insertAt?: number) {
  const id = projectId.value
  const sid = selectedSceneId.value
  const token = getAuthToken()
  if (!id || !sid || !token) return
  addingBoard.value = true
  try {
    const res = await $fetch<{ shot: CreativeShot }>(`/api/projects/${id}/scenes/${sid}/shots`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const mapped = applyCastNameConventionToShots(mapShotsFromApi([res.shot]))
    if (mapped[0]) {
      let next = [...shots.value, mapped[0]]
      const targetIndex = typeof insertAt === 'number'
        ? Math.max(0, Math.min(insertAt, next.length - 1))
        : next.length - 1
      if (targetIndex < next.length - 1) {
        const fromIndex = next.length - 1
        const reordered = [...next]
        const [moved] = reordered.splice(fromIndex, 1)
        reordered.splice(targetIndex, 0, moved!)
        next = reordered.map((s, i) => ({ ...s, sortOrder: i + 1 }))
        shots.value = next
        const ok = await persistShotOrder(next)
        if (!ok) {
          await loadShots({ preserveOnError: true })
        }
      } else {
        shots.value = next
      }
      boardDetailsOpenByShotId.value = {
        ...boardDetailsOpenByShotId.value,
        [mapped[0].id]: true
      }
      await loadScenes()
      toast.showToast('Board added.', 'success')
    }
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not add board'), 'error')
  } finally {
    addingBoard.value = false
  }
}

function onAddBoardCardClick () {
  if (draggingShotId.value || addingBoard.value || reordering.value) return
  void addBoard(shots.value.length)
}

async function deleteBoard (shot: CreativeShot) {
  const label = shot.title || `Board ${shots.value.findIndex(s => s.id === shot.id) + 1}`
  if (!confirm(`Delete “${label}” from this scene?`)) return
  const id = projectId.value
  const sid = selectedSceneId.value
  const token = getAuthToken()
  if (!id || !sid || !token) return
  deletingBoardId.value = shot.id
  try {
    await $fetch(`/api/projects/${id}/scenes/${sid}/shots/${shot.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    shots.value = shots.value.filter(s => s.id !== shot.id)
    for (const role of ['start', 'end'] as const) {
      const key = storyboardFrameSlotKey(shot.id, role)
      delete framePreview[key]
      delete framePreviewFailed[key]
      delete framePreviewLoading[key]
    }
    await loadScenes()
    toast.showToast('Board deleted.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not delete board'), 'error')
  } finally {
    deletingBoardId.value = null
  }
}


function mapShotsFromApi (list: CreativeShot[] | undefined): CreativeShot[] {
  if (!list?.length) return []
  return list.map((s) => {
    const merged = mergeLegacyShotPromptsToUnified({
      ...s,
      negativePrompt: s.negativePrompt || ''
    })
    return {
      ...s,
      imagePrompt: merged,
      videoPrompt: buildMotionPromptForShot({ ...s, imagePrompt: merged }),
      negativePrompt: s.negativePrompt || '',
      durationSeconds: snapToStoryboardClipSeconds(Number(s.durationSeconds) || 5)
    }
  })
}

async function loadShots (opts?: { preserveOnError?: boolean }) {
  generateError.value = ''
  if (!opts?.preserveOnError) {
    persistenceWarning.value = ''
    shotsPersisted.value = true
  }
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid || !isCloudProjectId(id)) {
    if (!opts?.preserveOnError) shots.value = []
    return false
  }
  const headers = await authHeaders()
  if (!headers) {
    if (!opts?.preserveOnError) shots.value = []
    return false
  }
  shotsLoading.value = true
  try {
    const res = await $fetch<{ shots: CreativeShot[] }>(
      `/api/projects/${id}/scenes/${sid}/shots`,
      { headers }
    )
    shots.value = applyCastNameConventionToShots(mapShotsFromApi(res.shots))
    shotsPersisted.value = true
    await loadStoryboardAssets()
    await applySavedFramesForCurrentScene()
    return true
  } catch (e: unknown) {
    if (!opts?.preserveOnError) {
      shots.value = []
      generateError.value = formatApiFetchError(e, 'Could not load shots for this scene.')
    }
    return false
  } finally {
    shotsLoading.value = false
  }
}

watch(
  () => [clientReady.value, isAuthenticated.value, project.value?.id, project.value?.source] as const,
  () => {
    void reloadCharacterRefs()
    if (clientReady.value && isAuthenticated.value && isCloudProject.value) {
      void loadStoryboardAssets().then(() => {
        if (shots.value.length) void applySavedFramesForCurrentScene()
      })
    }
  },
  { immediate: true }
)

watch(selectedSceneId, () => {
  showImageSettings.value = false
  boardDetailsOpenByShotId.value = {}
  void loadShots()
})

watch(
  [() => storyboardAssets.value.map(a => a.id).join('|'), () => shots.value.map(s => s.id).join('|')],
  () => {
    if (!selectedSceneId.value || !shots.value.length) return
    applySavedFramesForCurrentScene()
  }
)
</script>
