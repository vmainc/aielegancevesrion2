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
          on each board (or <span class="text-gray-700">Generate all images</span>) to fill the frames — cast portraits are used when available.
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
        v-if="project?.source !== 'pocketbase'"
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
                    <strong>Generate image</strong> fills each board’s frame and saves to Assets → Storyboards.
                    Cast portraits from Assets → Characters are used when available.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="shots.length && boardsMissingFrames > 0 && !generatingAllFrames"
            class="mt-4 flex flex-wrap items-center gap-3"
          >
            <button
              type="button"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-45"
              :disabled="!!imageGenId || !shotsPersisted"
              @click="generateAllFrames"
            >
              {{ generatingAllFrames ? 'Generating images…' : `Generate all images (${boardsMissingFrames})` }}
            </button>
            <p v-if="!shotsPersisted" class="text-xs text-amber-800">
              Save the shot list first (fix any warning above), then generate images.
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
          class="flex flex-wrap items-center justify-end gap-2 mb-3"
        >
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

        <ul v-if="!shotsLoading && shots.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <li
            v-for="(shot, idx) in shots"
            :key="shot.id"
            class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col shadow-sm"
          >
            <div class="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50 shrink-0">
              <span class="text-xs font-mono text-primary">BOARD {{ idx + 1 }}</span>
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs text-gray-500 truncate max-w-[12rem] sm:max-w-[55%] text-right">{{ shot.title || 'Untitled' }}</span>
                <button
                  v-if="shots.length > 1"
                  type="button"
                  class="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  :disabled="deletingBoardId === shot.id"
                  @click="deleteBoard(shot)"
                >
                  {{ deletingBoardId === shot.id ? '…' : 'Delete' }}
                </button>
              </div>
            </div>
            <div
              :class="[
                framePreviewBoxClass,
                'relative shrink-0 w-full rounded-none border-0 border-b border-gray-200 bg-gray-900 max-w-none mx-0',
                !hasDisplayableFrame(shot) && !framePreviewLoading[shot.id] ? 'border-dashed border-b-gray-300' : ''
              ]"
            >
                <button
                  v-if="panelImageSrc(shot)"
                  type="button"
                  class="absolute inset-0 w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  :aria-label="`View full size: ${shot.title || 'storyboard frame'}`"
                  @click="openFramePreview(shot)"
                >
                  <img
                    :key="`${shot.id}-${panelImageSrc(shot).slice(0, 80)}`"
                    :src="panelImageSrc(shot)"
                    :alt="shot.title || 'Storyboard frame'"
                    class="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
                    loading="eager"
                    @error="onFramePreviewImgError(shot)"
                  >
                </button>
                <div
                  v-else-if="framePreviewLoading[shot.id] || imageGenId === shot.id || frameUploadingId === shot.id"
                  class="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10"
                >
                  <FilmReelLoader
                    size="sm"
                    :label="frameUploadingId === shot.id ? 'Uploading…' : imageGenId === shot.id ? 'Generating…' : 'Loading frame…'"
                  />
                </div>
                <div
                  v-else
                  class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center"
                >
                  <p v-if="framePreviewFailed[shot.id]" class="text-xs text-amber-300">
                    Saved frame could not load — try Upload or Generate again.
                  </p>
                  <template v-else>
                    <p class="text-xs text-gray-400">
                      No frame yet
                    </p>
                    <div class="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        class="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700 disabled:opacity-45"
                        :disabled="frameUploadingId === shot.id || imageGenId === shot.id"
                        @click="triggerStoryboardUpload(shot)"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        class="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
                        :disabled="
                          imageGenId === shot.id ||
                          frameUploadingId === shot.id ||
                          generatingAllFrames ||
                          !((shot.imagePrompt || shot.description || '').trim())
                        "
                        @click="generateFrame(shot)"
                      >
                        Generate
                      </button>
                    </div>
                  </template>
                </div>
                <button
                  v-if="panelImageSrc(shot)"
                  type="button"
                  class="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] font-semibold rounded-md bg-gray-950/75 text-white hover:bg-red-700 border border-white/20 disabled:opacity-50"
                  :disabled="frameDeletingId === shot.id"
                  :aria-label="`Remove frame for ${shot.title || 'board'}`"
                  @click.stop="clearStoryboardFrame(shot)"
                >
                  {{ frameDeletingId === shot.id ? 'Removing…' : 'Remove' }}
                </button>
              </div>
            <div
              v-if="panelImageSrc(shot)"
              class="px-3 py-2 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 shrink-0"
            >
              <button
                type="button"
                class="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-45"
                :disabled="frameUploadingId === shot.id || imageGenId === shot.id"
                @click="triggerStoryboardUpload(shot)"
              >
                {{ frameUploadingId === shot.id ? 'Uploading…' : 'Replace' }}
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
                :disabled="
                  imageGenId === shot.id ||
                  frameUploadingId === shot.id ||
                  generatingAllFrames ||
                  !((shot.imagePrompt || shot.description || '').trim())
                "
                @click="generateFrame(shot)"
              >
                {{ imageGenId === shot.id ? 'Generating…' : 'Regenerate' }}
              </button>
              <span class="text-[11px] text-gray-500 ml-auto hidden sm:inline">
                {{ shot.shotType || 'Shot' }} · {{ shot.durationSeconds }}s
              </span>
            </div>
            <details
              class="group/board border-t border-gray-200"
              :open="boardDetailsOpenFor(shot)"
              @toggle="onBoardDetailsToggle($event, shot)"
            >
              <summary
                class="px-3 py-2.5 text-sm font-medium text-gray-800 cursor-pointer hover:bg-gray-50 list-none flex items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden"
              >
                <span class="inline-flex items-center gap-2 min-w-0">
                  <span
                    class="text-gray-400 text-[10px] leading-none transition-transform duration-200 group-open/board:rotate-180"
                    aria-hidden="true"
                  >▼</span>
                  <span>Board details</span>
                </span>
                <span class="text-xs font-normal text-gray-500 truncate max-w-[50%]">
                  {{ shot.shotType || 'Shot' }} · {{ shot.durationSeconds }}s
                </span>
              </summary>
              <div class="px-3 pb-4 pt-1 space-y-3 border-t border-gray-100 bg-gray-50/50">
                <div
                  v-if="!hasDisplayableFrame(shot) && !framePreviewLoading[shot.id]"
                  class="flex flex-wrap items-center gap-2"
                >
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-45"
                    :disabled="frameUploadingId === shot.id || imageGenId === shot.id"
                    @click="triggerStoryboardUpload(shot)"
                  >
                    {{ frameUploadingId === shot.id ? 'Uploading…' : 'Upload image' }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
                    :disabled="
                      imageGenId === shot.id ||
                      frameUploadingId === shot.id ||
                      generatingAllFrames ||
                      !((shot.imagePrompt || shot.description || '').trim())
                    "
                    @click="generateFrame(shot)"
                  >
                    {{ imageGenId === shot.id ? 'Generating…' : `Generate image (${activeImageModelLabel})` }}
                  </button>
                </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Board title</label>
                <input
                  v-model="shot.title"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                  @blur="saveShot(shot)"
                >
              </div>
              <div>
                <div class="flex justify-between items-start gap-2 mb-1">
                  <label class="text-xs font-medium text-gray-500">Story beat (short)</label>
                  <PromptEnhanceButton v-model="shot.description" context="story" />
                </div>
                <p class="text-[10px] text-gray-400 mb-1">
                  One-line beat for the board list. Cast names auto-capitalize (DOG, CAT) — ALL CAPS means use that character’s design, not a generic animal.
                </p>
                <textarea
                  v-model="shot.description"
                  rows="2"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y min-h-[3rem]"
                  @blur="saveShot(shot)"
                />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
                  <input
                    v-model="shot.shotType"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                    @blur="saveShot(shot)"
                  >
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Camera</label>
                  <input
                    v-model="shot.cameraMove"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                    @blur="saveShot(shot)"
                  >
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-500 mb-1">Clip (video)</label>
                  <select
                    v-model.number="shot.durationSeconds"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                    @change="saveShot(shot)"
                  >
                    <option :value="5">
                      5s
                    </option>
                    <option :value="10">
                      10s
                    </option>
                  </select>
                </div>
              </div>
              <div class="flex flex-col gap-1.5 pt-1">
                <p
                  v-if="shotCharacterMatches(shot).length"
                  class="text-[11px] text-gray-500 leading-snug"
                >
                  Cast continuity:
                  <span
                    v-for="(c, ci) in shotCharacterMatches(shot)"
                    :key="c.id"
                    class="font-medium text-gray-700"
                  >
                    {{ c.name.trim().toUpperCase() }}<span v-if="c.portraitUrl" class="text-primary"> · ref</span><span v-if="ci < shotCharacterMatches(shot).length - 1">, </span>
                  </span>
                </p>
              </div>
                <div class="pt-1 border-t border-gray-200">
                  <div class="flex justify-between items-center gap-2 mb-1 mt-2">
                    <label class="text-xs font-medium text-gray-500">Production prompt</label>
                    <PromptEnhanceButton v-model="shot.imagePrompt" context="shot_image" />
                  </div>
                  <textarea
                    v-model="shot.imagePrompt"
                    rows="10"
                    placeholder="Director bible, cast, scene, still-frame description, and exclusions…"
                    class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y font-mono text-[13px] leading-relaxed"
                    @blur="saveShot(shot)"
                  />
                  <p class="mt-1.5 text-[11px] text-gray-500 leading-snug">
                    Used for Generate image and the Video step.
                  </p>
                </div>
              </div>
            </details>
          </li>
        </ul>

        <div
          v-if="!shotsLoading && selectedSceneId && shots.length"
          class="flex flex-wrap items-center gap-3 pt-2"
        >
          <button
            type="button"
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded-lg disabled:opacity-50"
            :disabled="addingBoard"
            @click="addBoard"
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
          :to="`/projects/${projectId}/video`"
          class="text-sm text-primary font-medium hover:underline"
        >
          Next: Video →
        </NuxtLink>
        <NuxtLink
          :to="`/projects/${projectId}/timeline`"
          class="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Timeline
        </NuxtLink>
      </div>
    <input
      ref="storyboardFrameFileInput"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp,image/gif,image/*"
      @change="onStoryboardFrameFilePicked"
    >

    <Teleport to="body">
      <div
        v-if="expandedFrame"
        ref="framePreviewDialogEl"
        class="fixed inset-0 z-[110] bg-black/92 flex flex-col p-4 sm:p-6 pt-16 sm:pt-6"
        role="dialog"
        aria-modal="true"
        :aria-label="`Preview: ${expandedFrame.title}`"
        tabindex="-1"
        @click.self="closeFramePreview"
        @keydown.escape="closeFramePreview"
      >
        <button
          type="button"
          class="absolute top-4 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg ring-2 ring-white/40 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary"
          aria-label="Close image preview"
          @click="closeFramePreview"
        >
          <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>

        <div
          class="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0"
          @click.stop
        >
          <p class="text-sm font-medium text-white truncate mb-3 shrink-0 pr-28 sm:pr-36">
            {{ expandedFrame.title }}
          </p>
          <img
            :src="expandedFrame.url"
            :alt="expandedFrame.title"
            class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-8rem)] rounded-lg object-contain mx-auto"
          >
          <div class="mt-4 flex flex-wrap items-center justify-center gap-3 shrink-0">
            <p class="text-xs sm:text-sm text-white/75 text-center">
              Press
              <kbd class="mx-1 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">Esc</kbd>
              or click the dark area outside the image
            </p>
            <a
              v-if="expandedFrame.downloadUrl"
              :href="expandedFrame.downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white"
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </Teleport>

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
import {
  perSceneShotCap,
  resolveProjectDurationBudget
} from '~/lib/project-duration-budget'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { canonicalizeShotCastNames } from '~/lib/cast-name-convention'
import {
  collectCharacterPortraitUrls,
  findCharactersInShot,
  resolveCharactersForFrameGeneration
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
  mapStoryboardAssetsToShots,
  storyboardFrameMetadata
} from '~/lib/storyboard-panel-assets'
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

type SceneRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
  shotCount?: number
}

const scenes = ref<SceneRow[]>([])
const { refs: characterRefs, reload: reloadCharacterRefs } = useProjectCharacterRefs(projectId)
const storyboardAssets = ref<ProjectAsset[]>([])
const selectedSceneId = ref('')
const scenesLoadError = ref('')
const shots = ref<CreativeShot[]>([])
const shotStoryboardAssetMap = computed(() => {
  const sid = selectedSceneId.value
  if (!sid || !shots.value.length) return new Map<string, ProjectAsset>()
  return mapStoryboardAssetsToShots(shots.value, storyboardAssets.value, sid)
})
const shotsLoading = ref(false)
const generatingAllFrames = ref(false)
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
const uploadTargetShot = ref<CreativeShot | null>(null)
const isFullscreen = ref(false)
const showImageSettings = ref(false)
const imageModelOptions = CHARACTER_CREATOR_IMAGE_MODELS
const selectedImageModelId = ref<string>(DEFAULT_IMAGE_MODEL_ID)
const activeImageModelLabel = computed(
  () => imageModelOptions.find(m => m.id === selectedImageModelId.value)?.label || selectedImageModelId.value
)

const framePreviewBoxClass = computed(() => {
  const base = storyboardFramePreviewClasses(project.value?.aspectRatio)
  return base
    .replace('max-w-[min(100%,300px)]', 'max-w-none')
    .replace(/\bmx-auto\b/g, '')
})

const activeScene = computed(() => scenes.value.find(s => s.id === selectedSceneId.value))
const activeSceneShotCount = computed(() => {
  if (selectedSceneId.value && shots.value.length && !shotsLoading.value) {
    return shots.value.length
  }
  const n = Number(activeScene.value?.shotCount || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
})

const boardsMissingFrames = computed(() =>
  shots.value.filter(s => !shotHasFrame(s)).length
)

const durationBudget = computed(() =>
  project.value
    ? resolveProjectDurationBudget({
        targetDurationSeconds: project.value.targetDurationSeconds,
        targetLength: project.value.targetLength,
        goal: project.value.goal
      })
    : null
)

const activeSceneIndex = computed(() =>
  Math.max(0, scenes.value.findIndex(s => s.id === selectedSceneId.value))
)

const activeSceneClipSeconds = computed(() =>
  shots.value.reduce(
    (sum, sh) => sum + snapToStoryboardClipSeconds(Number(sh.durationSeconds) || 5),
    0
  )
)

const activeScenePanelEstimate = computed(() => {
  const budget = durationBudget.value
  if (!budget || !scenes.value.length) return ''
  const cap = perSceneShotCap(budget, scenes.value.length, activeSceneIndex.value)
  if (cap.minShots === cap.maxShots) {
    return `${cap.maxShots} panel${cap.maxShots === 1 ? '' : 's'}`
  }
  return `${cap.minShots}–${cap.maxShots} panels`
})

const storyboardTimingWarning = computed(() => {
  const budget = durationBudget.value
  if (!budget || !scenes.value.length) return ''
  const totalPanels = scenes.value.reduce(
    (sum, s) => sum + Math.max(0, Math.floor(Number(s.shotCount) || 0)),
    0
  )
  if (totalPanels <= budget.maxPanelsTotal) return ''
  const estSeconds = totalPanels * budget.clipSeconds
  return `This project targets ~${budget.totalSeconds}s (${budget.maxPanelsTotal} panels at ${budget.clipSeconds}s each), but you have ${totalPanels} panels (~${estSeconds}s). Rebuild from Director or trim scenes on the Scenes tab.`
})

function scenePanelLabel (scene: SceneRow): string {
  const existing = Number(scene.shotCount || 0)
  if (Number.isFinite(existing) && existing > 0) {
    return `${Math.floor(existing)} panel${Math.floor(existing) === 1 ? '' : 's'}`
  }
  const budget = durationBudget.value
  if (budget && scenes.value.length) {
    const idx = scenes.value.findIndex(s => s.id === scene.id)
    const cap = perSceneShotCap(budget, scenes.value.length, Math.max(0, idx))
    if (cap.maxShots < 1) return 'over budget'
    if (cap.minShots === cap.maxShots) return `${cap.maxShots} panel${cap.maxShots === 1 ? '' : 's'}`
    return `${cap.minShots}–${cap.maxShots} panels`
  }
  return 'est. 1–6 panels'
}

function shotCharacterMatches (shot: CreativeShot) {
  return findCharactersInShot(shot, characterRefs.value, activeScene.value?.summary)
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
    const src = panelImageSrc(shots.value[i]!)
    if (src) return src
  }
  return null
}

function frameGenerationReferenceUrls (shot: CreativeShot): string[] {
  const castInScope = resolveCharactersForFrameGeneration(
    shot,
    characterRefs.value,
    activeScene.value?.summary
  )
  const urls = collectCharacterPortraitUrls(castInScope, 4)
  const prior = priorStoryboardFrameInScene(shot)
  if (prior && !urls.includes(prior) && urls.length < 4) {
    urls.push(prior)
  }
  return urls.slice(0, 4)
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

function setPanelPreviewFromAsset (shotId: string, asset: ProjectAsset) {
  const url = assetPlaybackUrl(asset)
  if (!url) return
  framePreview[shotId] = url
  framePreviewFailed[shotId] = false
  framePreviewHydrateAttempts[shotId] = 0
  collapseBoardDetails(shotId)
}

/** URL for <img src> — cached preview, else linked library asset. */
function panelImageSrc (shot: CreativeShot): string {
  if (framePreviewFailed[shot.id]) return ''
  const cached = (framePreview[shot.id] || '').trim()
  if (cached) return cached
  const hit = storyboardAssetForShot(shot)
  if (hit) return assetPlaybackUrl(hit)
  return ''
}

async function onFramePreviewImgError (shot: CreativeShot) {
  const shotId = shot.id
  const attempts = (framePreviewHydrateAttempts[shotId] || 0) + 1
  framePreviewHydrateAttempts[shotId] = attempts
  if (attempts > 1) {
    framePreviewFailed[shotId] = true
    return
  }
  const hit = storyboardAssetForShot(shot)
  const raw = hit ? assetPlaybackUrl(hit) : (framePreview[shotId] || '').trim()
  if (!raw) {
    framePreviewFailed[shotId] = true
    return
  }
  framePreviewLoading[shotId] = true
  try {
    const headers = await authHeaders()
    const dataUrl = await fetchImageAsDataUrl(raw, { headers: headers ?? undefined })
    framePreview[shotId] = dataUrl
    framePreviewFailed[shotId] = false
  } catch {
    framePreviewFailed[shotId] = true
  } finally {
    framePreviewLoading[shotId] = false
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
    cast: characterRefs.value.map(c => ({
      name: c.name,
      traitsRoleVisual: c.roleDescription,
      portraitUrl: c.portraitUrl,
      portraitNotes: c.portraitNotes,
      portraitPromptUsed: c.portraitPromptUsed
    }))
  }
}

async function generateAllFrames () {
  if (!shotsPersisted.value) {
    toast.showToast('Shot list is not saved yet — rebuild from Director or fix the warning above.', 'error')
    return
  }
  const pending = shots.value.filter(s => !hasDisplayableFrame(s))
  if (!pending.length) {
    toast.showToast('All boards already have frames.', 'info')
    return
  }
  generatingAllFrames.value = true
  let ok = 0
  let failed = 0
  try {
    for (const shot of pending) {
      try {
        await generateFrame(shot)
        if (hasDisplayableFrame(shot)) ok++
        else failed++
      } catch {
        failed++
      }
    }
    if (ok && !failed) {
      toast.showToast(`Generated ${ok} frame(s).`, 'success')
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

async function generateFrame (shot: CreativeShot) {
  const basePrompt = (shot.imagePrompt || shot.description || '').trim()
  if (!basePrompt) {
    toast.showToast('Add a production prompt or story beat first.', 'info')
    return
  }
  const matches = shotCharacterMatches(shot)
  const panelIndex = shots.value.findIndex(s => s.id === shot.id)
  const prompt = resolveFrameGenerationPrompt(shot, {
    ...unifiedPromptContext(),
    panelIndex: panelIndex >= 0 ? panelIndex : undefined
  })
  const referenceImageUrls = frameGenerationReferenceUrls(shot)
  if (!referenceImageUrls.length) {
    const missingPortraits = characterRefs.value.filter(c => !c.portraitUrl?.trim())
    if (missingPortraits.length) {
      toast.showToast(
        'No cast portraits attached — add featured portraits under Assets → Characters for consistent looks.',
        'info'
      )
    }
  }
  imageGenId.value = shot.id
  try {
    const res = await $fetch<{ urls?: unknown[] }>('/api/generate/image', {
      method: 'POST',
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
      framePreviewFailed[shot.id] = false
      const saveErr = await autoSaveGeneratedFrame(shot, url, matches)
      if (!saveErr) {
        toast.showToast('Frame generated and saved.', 'success')
      } else {
        framePreview[shot.id] = url
        framePreviewFailed[shot.id] = false
        toast.showToast(`Frame generated (save failed): ${saveErr}`, 'warning')
      }
    } else {
      toast.showToast('No image returned.', 'error')
    }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Image generation failed')
        : 'Image generation failed'
    toast.showToast(msg, 'error')
  } finally {
    imageGenId.value = null
  }
}

function hasDisplayableFrame (shot: CreativeShot): boolean {
  return Boolean(panelImageSrc(shot))
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

function shotHasFrame (shot: CreativeShot): boolean {
  return Boolean(storyboardAssetForShot(shot)?.id) || Boolean((framePreview[shot.id] || '').trim())
}

function storyboardAssetForShot (shot: CreativeShot): ProjectAsset | null {
  return shotStoryboardAssetMap.value.get(shot.id) ?? null
}

function openFramePreview (shot: CreativeShot) {
  const url = panelImageSrc(shot)
  if (!url) return
  expandedFrame.value = {
    url,
    title: shot.title || 'Storyboard frame',
    downloadUrl: url
  }
  void nextTick(() => framePreviewDialogEl.value?.focus())
}

function closeFramePreview () {
  expandedFrame.value = null
}

async function clearStoryboardFrame (shot: CreativeShot) {
  const label = shot.title || 'this board'
  if (!confirm(`Remove the generated image for “${label}”?`)) return
  const pid = projectId.value
  const token = getAuthToken()
  frameDeletingId.value = shot.id
  try {
    const asset = storyboardAssetForShot(shot)
    if (asset && pid && token) {
      await $fetch(`/api/projects/${pid}/assets/${asset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      storyboardAssets.value = storyboardAssets.value.filter(a => a.id !== asset.id)
    }
    const previewUrl = framePreview[shot.id]
    delete framePreview[shot.id]
    delete framePreviewFailed[shot.id]
    if (expandedFrame.value?.url === previewUrl) {
      closeFramePreview()
    }
    toast.showToast('Frame removed.', 'success')
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not remove frame')
    toast.showToast(msg, 'error')
  } finally {
    frameDeletingId.value = null
  }
}

function applySavedFramesForCurrentScene () {
  for (const s of shots.value) {
    const hit = storyboardAssetForShot(s)
    if (hit) setPanelPreviewFromAsset(s.id, hit)
  }
}

function triggerStoryboardUpload (shot: CreativeShot) {
  uploadTargetShot.value = shot
  storyboardFrameFileInput.value?.click()
}

async function onStoryboardFrameFilePicked (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const shot = uploadTargetShot.value
  uploadTargetShot.value = null
  if (!file || !shot) return
  if (!file.type.startsWith('image/')) {
    toast.showToast('Choose an image file (JPEG, PNG, WebP, or GIF).', 'warning')
    return
  }
  await uploadStoryboardFrame(shot, file)
}

async function uploadStoryboardFrame (shot: CreativeShot, file: File) {
  const id = projectId.value
  const sid = selectedSceneId.value
  if (!id || !sid) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Log in to upload frames.', 'info')
    return
  }
  frameUploadingId.value = shot.id
  framePreviewFailed[shot.id] = false
  let localBlobUrl: string | null = null
  try {
    const matches = shotCharacterMatches(shot)
    const existing = storyboardAssetForShot(shot)
    if (existing?.id) {
      await $fetch(`/api/projects/${id}/assets/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      storyboardAssets.value = storyboardAssets.value.filter(a => a.id !== existing.id)
      delete framePreview[shot.id]
    }
    const uploadFile = await prepareImageFileForUpload(file)
    localBlobUrl = URL.createObjectURL(uploadFile)
    framePreview[shot.id] = localBlobUrl
    const fd = new FormData()
    fd.append('kind', 'storyboard')
    fd.append('title', `${shot.title || 'Storyboard Frame'} (uploaded)`.slice(0, 500))
    fd.append('notes', 'Uploaded storyboard frame')
    fd.append(
      'metadata',
      JSON.stringify(
        storyboardFrameMetadata(shot, sid, panelIndexForShot(shot), {
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
      setPanelPreviewFromAsset(shot.id, saved)
      await loadStoryboardAssets()
      const linked = storyboardAssetForShot(shot) || saved
      setPanelPreviewFromAsset(shot.id, linked)
      toast.showToast('Frame uploaded.', 'success')
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
  if (!id || project.value?.source !== 'pocketbase') return
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

async function removeStoryboardAssetForShot (shot: CreativeShot) {
  const existing = storyboardAssetForShot(shot)
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
  matches: ReturnType<typeof shotCharacterMatches>
): Promise<ProjectAsset | null> {
  const id = projectId.value
  const sid = selectedSceneId.value
  const token = getAuthToken()
  if (!id || !sid || !token) return null

  const title = `${shot.title || 'Storyboard Frame'} (${activeImageModelLabel.value})`.slice(0, 500)
  const metadata = storyboardFrameMetadata(shot, sid, panelIndexForShot(shot), {
    model_id: selectedImageModelId.value,
    model_label: activeImageModelLabel.value,
    character_ids: matches.map(c => c.id),
    character_names: matches.map(c => c.name)
  })

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
  matches: ReturnType<typeof shotCharacterMatches>
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
    await removeStoryboardAssetForShot(shot)
    const asset = await persistStoryboardAsset(shot, src, matches)
    if (asset?.id) {
      storyboardAssets.value = [asset, ...storyboardAssets.value.filter(a => a.id !== asset.id)]
      await loadStoryboardAssets()
      const linked = storyboardAssetForShot(shot) || asset
      setPanelPreviewFromAsset(shot.id, linked)
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

async function loadScenes () {
  scenesLoadError.value = ''
  if (project.value?.source !== 'pocketbase' || !isAuthenticated.value) {
    scenes.value = []
    return
  }
  const id = projectId.value
  if (!id) return
  const headers = await authHeaders()
  if (!headers) return
  try {
    const res = await $fetch<{ scenes: SceneRow[] }>(`/api/projects/${id}/scenes`, { headers })
    scenes.value = res.scenes || []
    if (!scenes.value.length) {
      selectedSceneId.value = ''
      shots.value = []
      return
    }
    const sceneFromQuery = typeof route.query.scene === 'string' ? route.query.scene : ''
    if (sceneFromQuery && scenes.value.some(s => s.id === sceneFromQuery)) {
      selectedSceneId.value = sceneFromQuery
    } else if (!selectedSceneId.value || !scenes.value.some(s => s.id === selectedSceneId.value)) {
      selectedSceneId.value = scenes.value[0].id
    }
  } catch (e: any) {
    scenes.value = []
    selectedSceneId.value = ''
    shots.value = []
    scenesLoadError.value =
      e?.data?.message || e?.message || 'Could not load scenes.'
  }
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

async function addBoard () {
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
      shots.value = [...shots.value, mapped[0]]
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
    delete framePreview[shot.id]
    delete framePreviewFailed[shot.id]
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
  if (!id || !sid || project.value?.source !== 'pocketbase') {
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
    void loadScenes()
    void reloadCharacterRefs()
    if (clientReady.value && isAuthenticated.value && project.value?.source === 'pocketbase') {
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
