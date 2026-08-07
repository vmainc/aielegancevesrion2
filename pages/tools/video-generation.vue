<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Video generation
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Pick model, format, and project first — prompt options adapt to what your model supports.
      </p>
      <p
        v-if="loadingPanelPrefill"
        class="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-gray-800 animate-pulse"
      >
        Loading storyboard panel — prompt and starting frame…
      </p>
      <p
        v-else-if="prefillBanner"
        class="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-gray-800"
      >
        {{ prefillBanner }}
      </p>
    </header>

    <div v-if="pending || loadingPanelPrefill" class="text-sm text-gray-600 mb-6 animate-pulse">
      {{ loadingPanelPrefill ? 'Loading panel from project…' : 'Loading models…' }}
    </div>

    <div
      v-else-if="error"
      class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-8"
    >
      {{ error }}
    </div>

    <template v-else>
      <p
        v-if="data?.notice && uiPhase === 'form'"
        class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
      >
        {{ data.notice }}
      </p>

      <!-- Generating: hide all options -->
      <div
        v-if="uiPhase === 'generating'"
        class="rounded-xl border border-primary/25 bg-primary/5 px-6 py-14 mb-10"
      >
        <FilmReelLoader
          size="lg"
          label="Generating video"
          :sub-label="generatingSubLabel"
        />
        <p class="mt-6 text-center text-sm text-gray-600 max-w-md mx-auto">
          Models are rendering in parallel. This can take a few minutes — please keep this tab open.
        </p>
      </div>

      <!-- Complete: preview + keep or discard -->
      <div
        v-else-if="uiPhase === 'complete'"
        class="space-y-8 mb-10"
      >
        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ successfulResults.length === 1 ? 'Your clip is ready' : 'Pick a clip to keep' }}
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              <template v-if="panelPrefill?.sceneId && panelPrefill?.shotId">
                Keep saves this clip to your project. Discard removes it so you can adjust settings and try again.
              </template>
              <template v-else>
                Keep saves to your project library. Discard removes generated clips from this run.
              </template>
            </p>
          </div>

          <p v-if="!successfulResults.length" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            All models failed. Adjust your prompt or try a different model.
          </p>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <label
              v-for="r in successfulResults"
              :key="r.modelId"
              class="rounded-xl overflow-hidden border cursor-pointer transition-colors"
              :class="selectedKeepModelId === r.modelId
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-gray-200 hover:border-primary/40'"
            >
              <div class="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <input
                  v-if="successfulResults.length > 1"
                  v-model="selectedKeepModelId"
                  type="radio"
                  :value="r.modelId"
                  class="text-primary focus:ring-primary"
                >
                <span class="text-sm font-semibold text-gray-900">{{ r.modelName }}</span>
              </div>
              <div class="aspect-video bg-black">
                <video
                  v-if="r.playbackUrl"
                  :src="playbackSrc(r.playbackUrl)"
                  class="w-full h-full object-contain"
                  controls
                  playsinline
                  preload="metadata"
                />
              </div>
            </label>
          </div>

          <div
            v-for="r in failedResults"
            :key="`err-${r.modelId}`"
            class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            <span class="font-semibold">{{ r.modelName }}:</span> {{ r.error }}
          </div>

          <button
            v-if="successfulResults.length"
            type="button"
            class="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-base sm:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!selectedPlaybackUrl || downloadingClip"
            @click="downloadSelectedClip"
          >
            <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            {{ downloadingClip ? 'Downloading…' : 'Download to your device' }}
          </button>

          <div class="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              :disabled="!successfulResults.length || keepingClip || discardingRun"
              @click="keepClipAndContinue"
            >
              {{ keepingClip ? 'Saving…' : keepButtonLabel }}
            </button>
            <button
              type="button"
              class="px-5 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              :disabled="keepingClip || discardingRun"
              @click="discardRunAndRetry"
            >
              {{ discardingRun ? 'Removing…' : 'Discard & try again' }}
            </button>
          </div>
        </section>
      </div>

      <form v-else class="space-y-8 mb-10" @submit.prevent="onSubmit">
        <!-- 1. Model, format & project (collapsible) -->
        <details
          class="rounded-xl border border-gray-200 bg-white overflow-hidden group"
          open
        >
          <summary
            class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-5 py-4 sm:px-6 flex items-start justify-between gap-3 hover:bg-gray-50/80 border-b border-transparent group-open:border-gray-200"
          >
            <div class="flex items-start gap-2.5 min-w-0 flex-1">
              <span
                class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                aria-hidden="true"
              >▶</span>
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Model, format & project
                </h2>
                <p class="text-xs text-gray-500 mt-1 group-open:hidden truncate">
                  {{ setupAccordionSummary }}
                </p>
                <p class="text-xs text-gray-500 mt-1 hidden group-open:block">
                  Pick model and clip format first — prompt options below adapt to what your model supports.
                </p>
              </div>
            </div>
          </summary>

          <div class="px-5 py-5 sm:px-6 sm:py-6 space-y-5 border-t border-gray-100">
          <div>
            <label for="vg-model" class="block text-sm font-medium text-gray-700 mb-1.5">Video model</label>
            <select
              id="vg-model"
              v-model="primaryModelId"
              required
              class="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
            >
              <option value="" disabled>Select a model</option>
              <option v-for="m in models" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
            <div
              v-if="primaryModel"
              class="mt-2 flex flex-wrap gap-1.5"
            >
              <span
                v-if="modelSupportsLastFrame(primaryModel)"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200"
              >Start + end frame</span>
              <span
                v-if="primaryModel.generateAudio"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary border border-primary/25"
              >Audio</span>
              <span
                v-if="primaryModel.supportsNegativePrompt"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-800 border border-violet-200"
              >Negative prompts</span>
              <span
                v-if="!primaryModel.generateAudio && !primaryModel.supportsNegativePrompt && !modelSupportsLastFrame(primaryModel)"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200"
              >Silent · prompt + start frame</span>
            </div>
            <p v-if="primaryModel?.description" class="mt-2 text-xs text-gray-500 line-clamp-2">
              {{ primaryModel.description }}
            </p>
          </div>

          <details v-if="primaryModelId && compareModelOptions.length" class="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2">
            <summary class="text-sm font-medium text-gray-800 cursor-pointer select-none py-1">
              Compare with another model (optional)
            </summary>
            <p class="text-xs text-gray-500 mt-1 mb-2">
              Runs a second generation in parallel so you can pick the better clip.
            </p>
            <div class="flex flex-wrap gap-2 pb-1">
              <label
                v-for="m in compareModelOptions"
                :key="m.id"
                class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm"
              >
                <input
                  v-model="compareModelIds"
                  type="checkbox"
                  :value="m.id"
                  class="rounded border-gray-300 text-primary focus:ring-primary"
                >
                <span class="text-gray-800">{{ m.name }}</span>
              </label>
            </div>
          </details>

          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label for="vg-aspect" class="block text-sm font-medium text-gray-700 mb-1.5">Aspect ratio</label>
              <select
                id="vg-aspect"
                v-model="aspectRatio"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option value="16:9">16:9 (landscape)</option>
                <option value="9:16">9:16 (vertical)</option>
                <option value="1:1">1:1 (square)</option>
              </select>
            </div>
            <div>
              <label for="vg-duration" class="block text-sm font-medium text-gray-700 mb-1.5">Clip length</label>
              <select
                id="vg-duration"
                v-model.number="durationSeconds"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option
                  v-for="sec in durationOptions"
                  :key="sec"
                  :value="sec"
                >
                  {{ sec }} seconds
                </option>
              </select>
              <p
                v-if="durationHint"
                class="mt-1.5 text-xs text-gray-500"
              >
                {{ durationHint }}
              </p>
            </div>
          </div>

          <template v-if="isAuthenticated">
            <div>
              <label for="vg-project" class="block text-sm font-medium text-gray-700 mb-1.5">Save to project</label>
              <div class="flex flex-wrap items-end gap-2">
                <select
                  id="vg-project"
                  v-model="selectedProjectId"
                  class="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="" disabled>Select project</option>
                  <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                    {{ p.name }}{{ p.accessRole === 'member' ? ' (shared)' : '' }}
                  </option>
                </select>
                <button
                  type="button"
                  class="shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                  @click="openCreateProjectModal"
                >
                  + New project
                </button>
              </div>
              <p v-if="!pbProjects.length" class="mt-2 text-xs text-gray-600">
                No projects yet — use <span class="font-medium text-gray-800">+ New project</span>.
              </p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                v-model="saveToProject"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
              >
              Save clip to project library (Assets → Video)
            </label>
          </template>
          <p v-else class="text-sm text-amber-800">
            <NuxtLink to="/login" class="text-primary font-medium underline">Sign in</NuxtLink>
            to attach clips to a project.
          </p>
          </div>
        </details>

        <!-- 2. Prompt & generation settings (after model) -->
        <section
          v-if="hasModelSelected"
          class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4"
        >
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Shot description
          </h2>

          <div
            v-if="showCharacterPicker"
            class="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-2"
          >
            <div>
              <label for="vg-characters" class="block text-sm font-medium text-gray-700">
                Characters in this shot
              </label>
              <p class="text-xs text-gray-500 mt-0.5">
                <template v-if="panelPrefill?.sceneId && panelSceneLabel">
                  Scene: {{ panelSceneLabel }}. Type a name to add cast — only selected plates lock frames and prompts.
                </template>
                <template v-else>
                  Type a name to add cast for frame generation and clip metadata. Big casts stay out of the way until you search.
                </template>
              </p>
            </div>
            <p v-if="projectCharactersLoading" class="text-xs text-gray-500">Loading cast…</p>
            <p v-else-if="projectCharactersError" class="text-xs text-red-600">{{ projectCharactersError }}</p>
            <p v-else-if="!projectCharacterOptions.length" class="text-xs text-gray-500">
              No characters on this project yet — add them on the Characters step.
            </p>
            <ProjectCharacterTypeahead
              v-else
              v-model="selectedCharacterIds"
              input-id="vg-characters"
              :options="characterTypeaheadOptions"
              :hint="characterTypeaheadHint"
              placeholder="Type a character name…"
            />
            <p v-if="refreshingPromptForCast" class="text-xs text-primary animate-pulse">
              Updating prompt for selected cast…
            </p>
          </div>

          <div>
            <div class="flex justify-between items-center gap-2 mb-1.5">
              <label for="vg-prompt" class="text-sm font-medium text-gray-700">Prompt</label>
              <PromptEnhanceButton v-model="prompt" context="video" />
            </div>
            <textarea
              id="vg-prompt"
              v-model="prompt"
              rows="4"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Motion, camera, lighting, mood — no background music"
            />
            <p
              v-if="productionBibleDebugLine"
              class="mt-1.5 text-xs text-gray-500"
            >
              {{ productionBibleDebugLine }}
            </p>
          </div>
          <div v-if="anySelectedSupportsNegative">
            <label for="vg-negative" class="block text-sm font-medium text-gray-700 mb-1.5">
              Negative prompt
              <span class="font-normal text-gray-500">(what to avoid)</span>
            </label>
            <textarea
              id="vg-negative"
              v-model="negativePrompt"
              rows="3"
              maxlength="4000"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="e.g. wrong hair color, extra fingers, text overlays, watermark, cartoon style"
            />
            <p
              v-if="negativePrompt.trim() && negativeDeliveryHint"
              class="mt-1.5 text-xs text-gray-500"
            >
              {{ negativeDeliveryHint }}
            </p>
          </div>
          <VideoStartFramePicker
            v-model:frame-image-url="startFrameUrl"
            role="start"
            :prompt="prompt"
            :aspect-ratio="aspectRatio"
            :bible-project-id="startFrameBibleProjectId"
            :bible-scene-id="panelPrefill?.sceneId"
            :bible-shot-id="panelPrefill?.shotId"
            :bible-character-ids="effectiveCharacterIds"
            :reference-image-urls="castPlateReferenceUrls"
          />
          <VideoStartFramePicker
            v-if="anySelectedSupportsEndFrame"
            v-model:frame-image-url="endFrameUrl"
            role="end"
            :prompt="prompt"
            :aspect-ratio="aspectRatio"
            :bible-project-id="startFrameBibleProjectId"
            :bible-scene-id="panelPrefill?.sceneId"
            :bible-shot-id="panelPrefill?.shotId"
            :bible-character-ids="effectiveCharacterIds"
            :reference-image-urls="castPlateReferenceUrls"
          />
          <p
            v-if="anySelectedSupportsEndFrame && endFrameCompatibilityHint"
            class="text-xs rounded-lg px-3 py-2"
            :class="endFrameCompatibilityWarn
              ? 'text-amber-900 bg-amber-50 border border-amber-200'
              : 'text-gray-500'"
          >
            {{ endFrameCompatibilityHint }}
          </p>

          <div v-if="anySelectedSupportsAudio" class="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-3">
            <label class="inline-flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="includeSpokenDialogue"
                type="checkbox"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span>
                <span class="font-medium text-gray-900">Include spoken dialogue</span>
                <span class="block text-xs text-gray-500 mt-0.5">
                  The model synthesizes speech in the video file (no background music).
                </span>
              </span>
            </label>
            <div v-if="includeSpokenDialogue" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="vg-dialogue-speaker" class="block text-sm font-medium text-gray-700 mb-1.5">
                    Who speaks
                  </label>
                  <select
                    id="vg-dialogue-speaker"
                    v-model="dialogueSpeakerId"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                    :disabled="!dialogueSpeakerOptions.length"
                  >
                    <option value="" disabled>
                      {{ dialogueSpeakerOptions.length ? 'Select character…' : 'No characters in shot' }}
                    </option>
                    <option
                      v-for="c in dialogueSpeakerOptions"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ c.name }}
                    </option>
                  </select>
                  <p v-if="!dialogueSpeakerOptions.length" class="mt-1 text-xs text-amber-800">
                    Select characters in this shot above so we can name who speaks.
                  </p>
                </div>
                <div>
                  <label for="vg-dialogue-tone" class="block text-sm font-medium text-gray-700 mb-1.5">
                    Tone
                  </label>
                  <select
                    id="vg-dialogue-tone"
                    v-model="dialogueTone"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                  >
                    <option
                      v-for="t in dialogueToneOptions"
                      :key="t.value"
                      :value="t.value"
                    >
                      {{ t.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label for="vg-dialogue" class="block text-sm font-medium text-gray-700 mb-1.5">
                  What {{ dialogueSpeakerName || 'they' }} say
                </label>
                <textarea
                  id="vg-dialogue"
                  v-model="dialogueLine"
                  rows="2"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                  placeholder='e.g. "We have to leave — now."'
                />
              </div>
            </div>

            <label class="inline-flex items-start gap-2 text-sm text-gray-800 cursor-pointer pt-1 border-t border-gray-100">
              <input
                v-model="includeAmbientSound"
                type="checkbox"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span>
                <span class="font-medium text-gray-900">Include ambient / background sound</span>
                <span class="block text-xs text-gray-500 mt-0.5">
                  Diegetic in-scene sound — rain, wind, hallway echo. Still no musical score.
                </span>
              </span>
            </label>
            <div v-if="includeAmbientSound">
              <div class="flex justify-between items-center gap-2 mb-1.5">
                <label for="vg-ambient" class="text-sm font-medium text-gray-700">Soundscape</label>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-xs font-medium text-gray-700 hover:text-primary hover:bg-primary/5 border border-gray-200 hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="generatingSoundscape || !prompt.trim()"
                  :aria-busy="generatingSoundscape"
                  :title="!prompt.trim() ? 'Add a video prompt first' : 'Generate a diegetic soundscape from the prompt'"
                  @click="generateSoundscape"
                >
                  <svg
                    v-if="generatingSoundscape"
                    class="w-3.5 h-3.5 animate-spin text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {{ generatingSoundscape ? 'Generating…' : 'Generate soundscape' }}
                </button>
              </div>
              <textarea
                id="vg-ambient"
                v-model="ambientSoundPrompt"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                placeholder="e.g. Soft rain on leaves, distant thunder, quiet forest birdsong"
              />
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="preset in ambientSoundPresets"
                  :key="preset.label"
                  type="button"
                  class="px-2 py-1 text-[11px] rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-primary/5"
                  @click="applyAmbientPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <p
              v-if="generatedAudioModelWarning"
              class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2"
            >
              {{ generatedAudioModelWarning }}
            </p>
          </div>

          <p class="text-xs text-gray-500">
            Clips are silent by default unless you enable audio above.
            <a
              href="https://openrouter.ai/models?fmt=cards&output_modalities=video"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Browse models on OpenRouter</a>.
          </p>
        </section>

        <p
          v-else
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-5 py-8 text-center text-sm text-gray-600"
        >
          Select a video model above to configure your prompt and frames.
        </p>

        <div v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </div>

        <div>
          <button
            type="submit"
            class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSubmit"
          >
            {{ generating ? `Generating… ${doneCount}/${selectedModelIdsList.length}` : 'Generate Video' }}
          </button>
        </div>
      </form>

      <section v-if="uiPhase === 'form' && hasAnySlot" class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <article
            v-for="m in models"
            v-show="selectedModelIdsList.includes(m.id) && slotByModel[m.id]"
            :key="m.id"
            class="rounded-xl overflow-hidden border border-gray-200 bg-white flex flex-col shadow-sm"
          >
            <div class="px-3 py-2.5 border-b border-gray-200 bg-gray-50">
              <span class="text-sm font-semibold text-gray-900">{{ m.name }}</span>
            </div>
            <div class="aspect-video bg-black flex items-center justify-center">
              <template v-if="slotByModel[m.id]?.status === 'loading'">
                <div class="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span class="text-xs">Rendering…</span>
                </div>
              </template>
              <video
                v-else-if="slotByModel[m.id]?.status === 'done' && slotByModel[m.id]?.playbackUrl"
                :src="playbackSrc(slotByModel[m.id]!.playbackUrl!)"
                class="w-full h-full object-contain"
                controls
                playsinline
                preload="metadata"
              />
              <p v-else-if="slotByModel[m.id]?.status === 'error'" class="text-xs text-red-400 px-4 text-center">
                {{ slotByModel[m.id]?.error }}
              </p>
            </div>
            <div
              v-if="slotByModel[m.id]?.status === 'done'"
              class="px-3 py-3 border-t border-gray-200 flex flex-wrap gap-2"
            >
              <NuxtLink
                to="/assets/video"
                class="text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                Assets → Video
              </NuxtLink>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="uiPhase === 'form'" class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div
          class="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-12 text-center text-sm text-gray-500"
        >
          Generated clips will appear here after you run Generate Video.
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="showCreateProject"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vg-create-project-title"
        @click.self="closeCreateProjectModal"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6"
          @click.stop
        >
          <h2 id="vg-create-project-title" class="text-lg font-semibold text-gray-900 mb-1">
            New project
          </h2>
          <p class="text-sm text-gray-500 mb-4">
            Create a cloud project and select it for saving clips — you stay on this page.
          </p>
          <form class="space-y-4" @submit.prevent="submitCreateProject">
            <div>
              <label for="vg-new-project-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="vg-new-project-name"
                v-model="createProjectForm.name"
                type="text"
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                placeholder="New project"
                autocomplete="off"
              >
            </div>
            <div>
              <label for="vg-new-project-aspect" class="block text-sm font-medium text-gray-700 mb-1">Aspect ratio</label>
              <select
                id="vg-new-project-aspect"
                v-model="createProjectForm.aspectRatio"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option value="16:9">16:9 (landscape)</option>
                <option value="9:16">9:16 (vertical)</option>
                <option value="1:1">1:1 (square)</option>
              </select>
            </div>
            <p v-if="createProjectError" class="text-sm text-red-600">{{ createProjectError }}</p>
            <div class="flex gap-2 justify-end pt-1">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                :disabled="creatingProject"
                @click="closeCreateProjectModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg disabled:opacity-50"
                :disabled="creatingProject"
              >
                {{ creatingProject ? 'Creating…' : 'Create & select' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  /** Panel prefill uses useState + API — client-only avoids SSR clearing query. */
  ssr: false,
  key: route =>
    `video-generation:${route.query.projectId || ''}:${route.query.sceneId || ''}:${route.query.shotId || ''}`
})

import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { downloadMediaFile, sanitizeDownloadFilename } from '~/lib/download-media-file'
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'
import { productionBibleGenerationDebugLabel } from '~/lib/production-bible-generation-context'
import {
  buildGenerationObservability,
  GENERATION_PATH,
  mergeGenerationObservabilityIntoMetadata
} from '~/lib/generation-observability'
import {
  clearVideoGenerationPanelPrefill,
  useVideoGenerationPrefillState,
  type VideoGenerationPrefill
} from '~/lib/video-generation-prefill'
import {
  generateOpenRouterVideo,
  playbackUrlForProjectVideoAsset,
  saveVideoToProjectLibrary
} from '~/composables/useOpenRouterVideoGen'
import { resolveVideoGenerationUserPrompt } from '~/lib/video-generation-audio-policy'
import { writeSessionWorkflow } from '~/lib/project-workflow-mode'
import {
  defaultAspectRatioFromPrefs,
  defaultDurationFromPrefs,
  parseVideoGenerationAspectRatio,
  parseVideoGenerationDurationSeconds,
  readVideoGenerationPrefs,
  videoToolDurationOptions,
  writeVideoGenerationPrefs,
  type VideoToolClipSeconds
} from '~/lib/video-generation-prefs'
import {
  collectCharacterPortraitUrls,
  findCharactersInShot,
  type ProjectCharacterRef
} from '~/lib/shot-character-continuity'
import type { CreativeProject, ProjectAspectRatio } from '~/types/creative-project'
import type { CreativeShot } from '~/types/creative-shot'
import type { CreativeSceneListItem } from '~/types/creative-scene'
import { useProjectCharacterRefs } from '~/composables/useProjectCharacterRefs'
import type { CharacterTypeaheadOption } from '~/components/project/CharacterTypeahead.vue'

const PB_ID = /^[a-z0-9]{15}$/

type VideoModel = {
  id: string
  name: string
  description?: string
  supportedDurations?: number[]
  generateAudio?: boolean
  supportsNegativePrompt?: boolean
  supportedFrameImages?: Array<'first_frame' | 'last_frame'>
}

type ApiPayload = {
  source?: string
  models?: VideoModel[]
  notice?: string
}

type Slot = {
  status: 'loading' | 'done' | 'error'
  playbackUrl?: string
  assetId?: string
  error?: string
}

type UiPhase = 'form' | 'generating' | 'complete'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isAuthenticated, getAuthToken, initAuth } = useAuth()
const authTokenState = useState<string | null>('auth_token')
const { projects, loadServerProjects, clientReady, registerImportedProject } = useCreativeProject()

const prefillState = useVideoGenerationPrefillState()

function stashedPanelPrefill (): VideoGenerationPrefill | null {
  const fromState = prefillState.value
  if (fromState?.prompt?.trim()) return fromState
  return null
}

const boot = import.meta.client ? stashedPanelPrefill() : null

const panelProjectId = computed(() => {
  const v = typeof route.query.projectId === 'string' ? route.query.projectId.trim() : ''
  return PB_ID.test(v) ? v : ''
})
const panelSceneId = computed(() => {
  const v = typeof route.query.sceneId === 'string' ? route.query.sceneId.trim() : ''
  return v || ''
})
const panelShotId = computed(() => {
  const v = typeof route.query.shotId === 'string' ? route.query.shotId.trim() : ''
  return v || ''
})
const hasPanelDeepLink = computed(() =>
  Boolean(panelProjectId.value && panelSceneId.value && panelShotId.value)
)

const { data, pending, error: fetchError } = await useFetch<ApiPayload>('/api/openrouter/video-models')

const error = computed(() => {
  if (fetchError.value) return 'Could not load models. Try again later.'
  return null
})

const models = computed(() => data.value?.models ?? [])

const prompt = ref(boot?.prompt?.trim() ?? '')
const negativePrompt = ref(boot?.negativePrompt?.trim() ?? '')
const startFrameUrl = ref<string | null>(
  boot?.startFrameUrl
    ? appendPlaybackAccessToken(boot.startFrameUrl.trim(), getAuthToken())
    : null
)
const endFrameUrl = ref<string | null>(
  boot?.endFrameUrl
    ? appendPlaybackAccessToken(boot.endFrameUrl.trim(), getAuthToken())
    : null
)
const aspectRatio = ref<'16:9' | '9:16' | '1:1'>(
  defaultAspectRatioFromPrefs(boot?.aspectRatio)
)
const durationSeconds = ref<VideoToolClipSeconds>(
  defaultDurationFromPrefs(boot?.durationSeconds)
)
const includeSpokenDialogue = ref(false)
const dialogueLine = ref('')
const dialogueSpeakerId = ref('')
const dialogueTone = ref('neutral')
const includeAmbientSound = ref(false)
const ambientSoundPrompt = ref('')
const generatingSoundscape = ref(false)

const dialogueToneOptions = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'calm', label: 'Calm' },
  { value: 'soft', label: 'Soft' },
  { value: 'whispered', label: 'Whispered' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'tense', label: 'Tense' },
  { value: 'angry', label: 'Angry' },
  { value: 'fearful', label: 'Fearful' },
  { value: 'sad', label: 'Sad' },
  { value: 'excited', label: 'Excited' },
  { value: 'confident', label: 'Confident' },
  { value: 'deadpan', label: 'Deadpan' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' }
] as const

const ambientSoundPresets = [
  { label: 'Rain & thunder', text: 'Soft rain on surfaces, occasional distant thunder, no music.' },
  { label: 'Forest', text: 'Birdsong, rustling leaves, light wind through trees, no music.' },
  { label: 'Hallway', text: 'School or office hallway echo, muffled footsteps and distant voices, no music.' },
  { label: 'City street', text: 'Distant traffic hum, occasional horn, urban ambience, no music.' },
  { label: 'Room tone', text: 'Quiet room HVAC hum, subtle fabric and movement sounds, no music.' }
] as const

function applyAmbientPreset (preset: (typeof ambientSoundPresets)[number]) {
  ambientSoundPrompt.value = preset.text
  includeAmbientSound.value = true
}

async function generateSoundscape () {
  const scene = prompt.value.trim()
  if (!scene || generatingSoundscape.value) return
  generatingSoundscape.value = true
  try {
    const res = await $fetch<{ enhanced: string }>('/api/prompt/enhance', {
      method: 'POST',
      body: {
        prompt: scene,
        context: 'soundscape',
        fieldHint: 'Ambient / SFX soundscape',
        projectId:
          selectedProjectId.value && PB_ID.test(selectedProjectId.value)
            ? selectedProjectId.value
            : undefined
      }
    })
    const next = (res.enhanced || '').trim()
    if (!next) throw new Error('Empty soundscape')
    ambientSoundPrompt.value = next
    includeAmbientSound.value = true
    toast.showToast('Soundscape generated.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not generate soundscape'), 'error')
  } finally {
    generatingSoundscape.value = false
  }
}
const primaryModelId = ref('')
const compareModelIds = ref<string[]>([])
const prefsHydrated = ref(false)
const modelsPrefsHydrated = ref(false)
const formError = ref('')
const generating = ref(false)
const doneCount = ref(0)
const saveToProject = ref(boot?.saveToProject ?? true)
const selectedProjectId = ref(
  panelProjectId.value ||
    (boot?.projectId && PB_ID.test(boot.projectId) ? boot.projectId : '')
)
const pinnedProjectId = ref(
  panelProjectId.value ||
    (boot?.projectId && PB_ID.test(boot.projectId) ? boot.projectId : '')
)
const slotByModel = reactive<Record<string, Slot>>({})
const uiPhase = ref<UiPhase>('form')
const selectedKeepModelId = ref('')
const keepingClip = ref(false)
const discardingRun = ref(false)
const downloadingClip = ref(false)
const panelPrefill = ref<VideoGenerationPrefill | null>(boot)
const productionBibleDebugLine = computed(() => {
  const ctx = panelPrefill.value?.productionBibleContext
  if (!ctx) return ''
  return productionBibleGenerationDebugLabel(ctx)
})
const startFrameBibleProjectId = computed(() => {
  const fromPanel = panelPrefill.value?.projectId?.trim() || ''
  if (fromPanel && PB_ID.test(fromPanel)) return fromPanel
  const selected = selectedProjectId.value.trim()
  return PB_ID.test(selected) ? selected : ''
})

const characterProjectId = computed(() => startFrameBibleProjectId.value)
const {
  refs: projectCharacterRefs,
  loading: projectCharactersLoading,
  loadError: projectCharactersError
} = useProjectCharacterRefs(characterProjectId)

const selectedCharacterIds = ref<string[]>(
  boot?.characterIds?.filter(id => PB_ID.test(id)) ?? []
)
const suppressCastPromptRefresh = ref(false)
const refreshingPromptForCast = ref(false)
const initialSceneSelectionApplied = ref(false)
const panelScene = ref<Pick<CreativeSceneListItem, 'heading' | 'summary'> | null>(null)
const panelShot = ref<CreativeShot | null>(null)

const showCharacterPicker = computed(() =>
  Boolean(isAuthenticated.value && startFrameBibleProjectId.value && primaryModelId.value)
)

const sceneCharacterIds = computed(() => {
  if (!panelShot.value || !projectCharacterRefs.value.length) return new Set<string>()
  const inShot = findCharactersInShot(
    panelShot.value,
    projectCharacterRefs.value,
    panelScene.value?.summary
  )
  return new Set(inShot.map(c => c.id))
})

type CharacterOption = ProjectCharacterRef & { inScene: boolean }

/** Characters named in the current prompt — light suggestions when not from a storyboard panel. */
const promptMentionedCharacterIds = computed(() => {
  const text = prompt.value.trim()
  if (!text || !projectCharacterRefs.value.length) return new Set<string>()
  const hits = findCharactersInShot(
    { title: '', description: text, imagePrompt: '', videoPrompt: text, shotType: '' },
    projectCharacterRefs.value
  )
  return new Set(hits.map(c => c.id))
})

const projectCharacterOptions = computed<CharacterOption[]>(() => {
  const inScene = sceneCharacterIds.value
  const hasSceneContext = Boolean(panelPrefill.value?.sceneId && panelShot.value)
  const promptHits = promptMentionedCharacterIds.value
  return projectCharacterRefs.value
    .map(c => ({
      ...c,
      inScene: hasSceneContext ? inScene.has(c.id) : promptHits.has(c.id)
    }))
    .sort((a, b) => {
      if (a.inScene !== b.inScene) return a.inScene ? -1 : 1
      return a.name.localeCompare(b.name)
    })
})

const characterTypeaheadOptions = computed<CharacterTypeaheadOption[]>(() =>
  projectCharacterOptions.value.map(c => ({
    id: c.id,
    name: c.name,
    suggested: c.inScene,
    badge: c.inScene
      ? (panelPrefill.value?.sceneId ? 'In scene' : 'In prompt')
      : undefined
  }))
)

const characterTypeaheadHint = computed(() => {
  if (selectedCharacterIds.value.length) {
    return `${selectedCharacterSummary.value}. Type to add more — full cast stays hidden until you search.`
  }
  if (panelPrefill.value?.sceneId) {
    return 'Focus the field to see scene cast, or type any name from the project.'
  }
  return 'Type a name to add cast. Nothing is pre-selected from large casts.'
})

const effectiveCharacterIds = computed(() =>
  selectedCharacterIds.value.filter(id => projectCharacterRefs.value.some(c => c.id === id))
)

/** Cast isolation plates for seed-frame generation (featured + turnarounds). */
const castPlateReferenceUrls = computed(() => {
  const ids = new Set(effectiveCharacterIds.value)
  if (!ids.size) return []
  return collectCharacterPortraitUrls(
    projectCharacterRefs.value.filter(c => ids.has(c.id)),
    4
  )
})

const selectedCharacterSummary = computed(() => {
  const names = projectCharacterRefs.value
    .filter(c => selectedCharacterIds.value.includes(c.id))
    .map(c => c.name)
  if (!names.length) return 'No characters selected'
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
})

const panelSceneLabel = computed(() => {
  const heading = (panelScene.value?.heading || '').trim()
  if (heading) return heading
  return (panelPrefill.value?.shotTitle || '').trim()
})

const dialogueSpeakerOptions = computed(() => {
  const selected = new Set(effectiveCharacterIds.value)
  if (selected.size) {
    return projectCharacterRefs.value.filter(c => selected.has(c.id))
  }
  return projectCharacterOptions.value.filter(c => c.inScene)
})

const dialogueSpeakerName = computed(() => {
  const id = dialogueSpeakerId.value
  if (!id) return ''
  return dialogueSpeakerOptions.value.find(c => c.id === id)?.name
    || projectCharacterRefs.value.find(c => c.id === id)?.name
    || ''
})

function syncDialogueSpeakerSelection () {
  const options = dialogueSpeakerOptions.value
  if (!options.length) {
    dialogueSpeakerId.value = ''
    return
  }
  if (options.some(c => c.id === dialogueSpeakerId.value)) return
  dialogueSpeakerId.value = options[0]?.id || ''
}

watch(dialogueSpeakerOptions, () => {
  syncDialogueSpeakerSelection()
}, { deep: true })

watch(includeSpokenDialogue, (on) => {
  if (on) syncDialogueSpeakerSelection()
})

let refreshPromptTimer: ReturnType<typeof setTimeout> | null = null

async function loadPanelSceneContext () {
  const pre = panelPrefill.value
  const pid = startFrameBibleProjectId.value
  if (!pre?.sceneId || !pre?.shotId || !PB_ID.test(pid)) {
    panelScene.value = null
    panelShot.value = null
    return
  }
  const headers = authHeaders()
  if (!headers) return
  try {
    const [sceneRes, shotsRes] = await Promise.all([
      $fetch<{ scene: CreativeSceneListItem }>(`/api/projects/${pid}/scenes/${pre.sceneId}`, { headers }),
      $fetch<{ shots: CreativeShot[] }>(`/api/projects/${pid}/scenes/${pre.sceneId}/shots`, { headers })
    ])
    panelScene.value = {
      heading: sceneRes.scene.heading,
      summary: sceneRes.scene.summary
    }
    panelShot.value = shotsRes.shots.find(s => s.id === pre.shotId) || null
    applySceneDefaultCharacterSelection()
  } catch {
    panelScene.value = null
    panelShot.value = null
  }
}

function applySceneDefaultCharacterSelection () {
  if (initialSceneSelectionApplied.value || !panelShot.value || !projectCharacterRefs.value.length) return
  const inScene = findCharactersInShot(
    panelShot.value,
    projectCharacterRefs.value,
    panelScene.value?.summary
  )
  if (!inScene.length) return
  suppressCastPromptRefresh.value = true
  selectedCharacterIds.value = inScene.map(c => c.id)
  suppressCastPromptRefresh.value = false
  initialSceneSelectionApplied.value = true
}

async function refreshPromptForSelectedCharacters () {
  const pre = panelPrefill.value
  const pid = startFrameBibleProjectId.value
  if (!pre?.sceneId || !pre?.shotId || !PB_ID.test(pid)) return
  const headers = authHeaders()
  if (!headers) return
  refreshingPromptForCast.value = true
  try {
    const res = await $fetch<VideoGenerationPrefill>(
      `/api/projects/${pid}/video-panel-prefill`,
      {
        query: {
          sceneId: pre.sceneId,
          shotId: pre.shotId,
          characterIds: selectedCharacterIds.value.join(',')
        },
        headers
      }
    )
    suppressCastPromptRefresh.value = true
    prompt.value = res.prompt
    negativePrompt.value = (res.negativePrompt || '').trim()
    panelPrefill.value = {
      ...pre,
      characterIds: [...selectedCharacterIds.value],
      productionBibleContext: res.productionBibleContext ?? pre.productionBibleContext
    }
  } catch {
    // User may have cleared all cast — keep their selection.
  } finally {
    suppressCastPromptRefresh.value = false
    refreshingPromptForCast.value = false
  }
}

watch(selectedCharacterIds, () => {
  if (suppressCastPromptRefresh.value) return
  const pre = panelPrefill.value
  if (!pre?.sceneId || !pre?.shotId) return
  if (refreshPromptTimer) clearTimeout(refreshPromptTimer)
  refreshPromptTimer = setTimeout(() => void refreshPromptForSelectedCharacters(), 400)
}, { deep: true })

watch(projectCharacterRefs, () => {
  applySceneDefaultCharacterSelection()
})

watch(startFrameBibleProjectId, (pid, prev) => {
  if (pid === prev) return
  if (!pid) {
    selectedCharacterIds.value = []
    panelScene.value = null
    panelShot.value = null
    initialSceneSelectionApplied.value = false
    return
  }
  if (!panelPrefill.value?.sceneId) {
    panelScene.value = null
    panelShot.value = null
    initialSceneSelectionApplied.value = false
    if (!panelPrefill.value?.characterIds?.length) {
      selectedCharacterIds.value = []
    }
  }
})
const prefillBanner = ref(
  boot?.shotTitle?.trim()
    ? `Opened from project storyboard — “${boot.shotTitle.trim()}”. Prompt and frames are prefilled; confirm model and project above.`
    : boot?.prompt?.trim()
      ? 'Opened from a project panel — prompt and frames are prefilled; confirm model and project above.'
      : ''
)
const prefillApplied = ref(Boolean(boot?.prompt?.trim()))
const loadingPanelPrefill = ref(false)

const showCreateProject = ref(false)
const creatingProject = ref(false)
const createProjectError = ref('')
const createProjectForm = reactive({
  name: '',
  aspectRatio: '16:9' as ProjectAspectRatio
})

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

const selectedModelIdsList = computed(() => {
  const ids = [primaryModelId.value, ...compareModelIds.value].filter(Boolean)
  return [...new Set(ids)]
})

const durationOptions = computed(() => {
  const selected = models.value.filter(m => selectedModelIdsList.value.includes(m.id))
  return videoToolDurationOptions(selected.length ? selected : models.value)
})

const durationHint = computed(() => {
  if (!durationOptions.value.includes(15)) {
    return '15s needs Seedance 2.0 or 2.0 Fast (or another model that lists 15s).'
  }
  if (durationSeconds.value === 15) {
    return '15s is supported by Seedance 2.0 / 2.0 Fast. Other selected models snap to their closest length.'
  }
  return ''
})

watch(
  durationOptions,
  (opts) => {
    if (!opts.includes(durationSeconds.value as VideoToolClipSeconds)) {
      const next = opts.includes(10) ? 10 : opts[0] || 5
      durationSeconds.value = next
    }
  },
  { immediate: true }
)

const primaryModel = computed(() =>
  models.value.find(m => m.id === primaryModelId.value)
)

const compareModelOptions = computed(() =>
  models.value.filter(m => m.id !== primaryModelId.value)
)

const hasModelSelected = computed(() => Boolean(primaryModelId.value))

const setupAccordionSummary = computed(() => {
  const parts: string[] = []
  parts.push(primaryModel.value?.name || 'No model selected')
  parts.push(aspectRatio.value)
  parts.push(`${durationSeconds.value}s`)
  if (isAuthenticated.value && selectedProjectId.value) {
    const project = pbProjects.value.find(p => p.id === selectedProjectId.value)
    parts.push(project?.name || 'Project')
  } else if (!isAuthenticated.value) {
    parts.push('Not signed in')
  }
  if (compareModelIds.value.length) {
    parts.push(`+${compareModelIds.value.length} compare`)
  }
  return parts.join(' · ')
})

function syncSelectedProjectFromPin () {
  const pin = pinnedProjectId.value.trim()
  if (!pin || !PB_ID.test(pin)) return
  if (pbProjects.value.some(p => p.id === pin)) {
    selectedProjectId.value = pin
    return
  }
  pinnedProjectId.value = ''
}

function dropStaleSelectedProject () {
  const id = selectedProjectId.value.trim()
  if (!id || !PB_ID.test(id)) return
  if (pbProjects.value.length && !pbProjects.value.some(p => p.id === id)) {
    selectedProjectId.value = pbProjects.value[0]?.id || ''
    if (pinnedProjectId.value === id) pinnedProjectId.value = ''
  }
}

watch([pbProjects, clientReady], () => {
  dropStaleSelectedProject()
  if (pinnedProjectId.value) {
    syncSelectedProjectFromPin()
    return
  }
  hydrateVideoGenerationPrefs()
  if (!selectedProjectId.value && pbProjects.value.length && prefsHydrated.value) {
    selectedProjectId.value = pbProjects.value[0].id
  }
}, { immediate: true })

function hydrateVideoGenerationPrefs () {
  if (!import.meta.client) return
  const prefs = readVideoGenerationPrefs()

  if (!pinnedProjectId.value && prefs.projectId && PB_ID.test(prefs.projectId)) {
    if (!pbProjects.value.length || pbProjects.value.some(p => p.id === prefs.projectId)) {
      selectedProjectId.value = prefs.projectId
      saveToProject.value = true
    }
  }

  if (!modelsPrefsHydrated.value && models.value.length) {
    const validPrimary =
      prefs.primaryModelId && models.value.some(m => m.id === prefs.primaryModelId)
        ? prefs.primaryModelId
        : models.value[0]?.id || ''
    if (validPrimary) {
      primaryModelId.value = validPrimary
    }
    if (prefs.compareModelIds?.length) {
      compareModelIds.value = prefs.compareModelIds.filter(
        id => id !== primaryModelId.value && models.value.some(m => m.id === id)
      )
    }
    modelsPrefsHydrated.value = true
  }

  if (!prefillApplied.value && !boot?.aspectRatio) {
    const ar = parseVideoGenerationAspectRatio(prefs.aspectRatio)
    if (ar) aspectRatio.value = ar
  }
  if (!prefillApplied.value && !boot?.durationSeconds) {
    const dur = parseVideoGenerationDurationSeconds(prefs.durationSeconds)
    if (dur) durationSeconds.value = dur
  }

  if (modelsPrefsHydrated.value && (primaryModelId.value || !models.value.length)) {
    prefsHydrated.value = true
  }
}

watch(models, () => {
  hydrateVideoGenerationPrefs()
}, { immediate: true })

function persistVideoGenerationPrefs () {
  if (!import.meta.client) return
  writeVideoGenerationPrefs({
    primaryModelId: primaryModelId.value || undefined,
    compareModelIds: compareModelIds.value.length ? [...compareModelIds.value] : undefined,
    projectId:
      selectedProjectId.value && PB_ID.test(selectedProjectId.value)
        ? selectedProjectId.value
        : undefined,
    aspectRatio: aspectRatio.value,
    durationSeconds: durationSeconds.value
  })
}

watch(
  [primaryModelId, compareModelIds, selectedProjectId, aspectRatio, durationSeconds],
  persistVideoGenerationPrefs,
  { deep: true }
)

watch(primaryModelId, (id) => {
  compareModelIds.value = compareModelIds.value.filter(mid => mid !== id)
  const m = models.value.find(x => x.id === id)
  if (!m?.generateAudio) {
    includeSpokenDialogue.value = false
    includeAmbientSound.value = false
  }
  if (!modelSupportsLastFrame(m)) {
    endFrameUrl.value = null
  }
})

function openCreateProjectModal () {
  createProjectForm.name = ''
  createProjectForm.aspectRatio = aspectRatio.value
  createProjectError.value = ''
  showCreateProject.value = true
}

function closeCreateProjectModal () {
  if (creatingProject.value) return
  showCreateProject.value = false
}

async function submitCreateProject () {
  createProjectError.value = ''
  const token = getAuthToken()
  if (!token) {
    createProjectError.value = 'Sign in to create a cloud project.'
    return
  }
  const displayName = createProjectForm.name.trim() || 'New project'
  const projectAspect = createProjectForm.aspectRatio
  const goal = projectAspect === '9:16' ? 'social' : 'film'
  creatingProject.value = true
  try {
    const res = await $fetch<{ project: CreativeProject }>('/api/projects/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: displayName,
        aspectRatio: projectAspect,
        goal,
        workflowMode: 'idea'
      }
    })
    writeSessionWorkflow(res.project.id, res.project.workflowMode || 'idea')
    registerImportedProject(res.project)
    selectedProjectId.value = res.project.id
    saveToProject.value = true
    aspectRatio.value = projectAspect
    showCreateProject.value = false
    toast.showToast(`“${res.project.name}” created and selected.`, 'success')
  } catch (e: unknown) {
    createProjectError.value = formatApiFetchError(e, 'Could not create project.')
  } finally {
    creatingProject.value = false
  }
}

function applyVideoGenerationPrefill (p: VideoGenerationPrefill) {
  panelPrefill.value = p
  prompt.value = p.prompt.trim()
  negativePrompt.value = (p.negativePrompt || '').trim()
  if (p.startFrameUrl) {
    startFrameUrl.value = appendPlaybackAccessToken(p.startFrameUrl.trim(), getAuthToken())
  }
  if (p.endFrameUrl) {
    endFrameUrl.value = appendPlaybackAccessToken(p.endFrameUrl.trim(), getAuthToken())
  } else {
    endFrameUrl.value = null
  }
  if (p.aspectRatio) aspectRatio.value = p.aspectRatio
  if (typeof p.durationSeconds === 'number') {
    const dur = parseVideoGenerationDurationSeconds(p.durationSeconds)
    if (dur) durationSeconds.value = dur
  }
  if (p.saveToProject !== undefined) saveToProject.value = p.saveToProject
  if (p.projectId && PB_ID.test(p.projectId)) {
    pinnedProjectId.value = p.projectId
    selectedProjectId.value = p.projectId
    saveToProject.value = true
    syncSelectedProjectFromPin()
  }
  suppressCastPromptRefresh.value = true
  selectedCharacterIds.value = (p.characterIds || []).filter(id => PB_ID.test(id))
  suppressCastPromptRefresh.value = false
  initialSceneSelectionApplied.value = false
  void loadPanelSceneContext()
  const label = (p.shotTitle || '').trim()
  prefillBanner.value = label
    ? `Opened from project storyboard — “${label}”. Prompt and frames are prefilled; confirm model and project above.`
    : 'Opened from a project panel — prompt and frames are prefilled; confirm model and project above.'
}

function stripPanelQueryFromRoute () {
  if (!import.meta.client) return
  const q = { ...route.query }
  let changed = false
  for (const key of ['projectId', 'sceneId', 'shotId'] as const) {
    if (key in q) {
      delete q[key]
      changed = true
    }
  }
  if (changed) void router.replace({ path: route.path, query: q })
}

async function fetchPanelPrefillFromApi (): Promise<boolean> {
  if (!hasPanelDeepLink.value || prefillApplied.value || !import.meta.client) return false

  await initAuth()
  const token = getAuthToken()
  if (!token) return false

  loadingPanelPrefill.value = true
  try {
    const res = await $fetch<VideoGenerationPrefill>(
      `/api/projects/${panelProjectId.value}/video-panel-prefill`,
      {
        query: {
          sceneId: panelSceneId.value,
          shotId: panelShotId.value
        },
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    applyVideoGenerationPrefill(res)
    prefillApplied.value = true
    clearVideoGenerationPanelPrefill()
    stripPanelQueryFromRoute()
    return true
  } catch (e: unknown) {
    if (!prefillApplied.value) {
      toast.showToast(
        formatApiFetchError(e, 'Could not load panel for video generation.'),
        'error'
      )
    }
    return false
  } finally {
    loadingPanelPrefill.value = false
  }
}

function tryApplyStashedPrefill (): boolean {
  if (prefillApplied.value || !import.meta.client) return false
  const payload = stashedPanelPrefill()
  if (!payload?.prompt?.trim()) return false
  applyVideoGenerationPrefill(payload)
  prefillApplied.value = true
  clearVideoGenerationPanelPrefill()
  stripPanelQueryFromRoute()
  return true
}

onMounted(async () => {
  await initAuth()
  if (prefillApplied.value && panelPrefill.value?.startFrameUrl?.trim()) {
    startFrameUrl.value = appendPlaybackAccessToken(
      panelPrefill.value.startFrameUrl.trim(),
      getAuthToken()
    )
  }
  if (prefillApplied.value && panelPrefill.value?.endFrameUrl?.trim()) {
    endFrameUrl.value = appendPlaybackAccessToken(
      panelPrefill.value.endFrameUrl.trim(),
      getAuthToken()
    )
  }
  if (!tryApplyStashedPrefill() && hasPanelDeepLink.value) {
    await fetchPanelPrefillFromApi()
  }
  if (panelPrefill.value?.sceneId && panelPrefill.value?.shotId) {
    void loadPanelSceneContext()
  }
  if (isAuthenticated.value && clientReady.value) {
    void loadServerProjects().then(() => {
      syncSelectedProjectFromPin()
    })
  }
})

watch(
  hasPanelDeepLink,
  (ready) => {
    if (!ready || prefillApplied.value || !import.meta.client) return
    if (tryApplyStashedPrefill()) return
    void fetchPanelPrefillFromApi()
  },
  { immediate: true }
)

watch(isAuthenticated, (v) => {
  if (v && hasPanelDeepLink.value && !prefillApplied.value) {
    if (tryApplyStashedPrefill()) return
    void fetchPanelPrefillFromApi()
  }
  if (v) {
    void loadServerProjects().then(() => {
      syncSelectedProjectFromPin()
    })
  }
})

const hasAnySlot = computed(() => Object.keys(slotByModel).length > 0)

const successfulResults = computed(() =>
  selectedModelIdsList.value
    .filter(id => slotByModel[id]?.status === 'done' && slotByModel[id]?.playbackUrl)
    .map(id => ({
      modelId: id,
      modelName: models.value.find(m => m.id === id)?.name || id,
      playbackUrl: slotByModel[id]!.playbackUrl!,
      assetId: slotByModel[id]?.assetId
    }))
)

const failedResults = computed(() =>
  selectedModelIdsList.value
    .filter(id => slotByModel[id]?.status === 'error')
    .map(id => ({
      modelId: id,
      modelName: models.value.find(m => m.id === id)?.name || id,
      error: slotByModel[id]?.error || 'Generation failed'
    }))
)

const generatingSubLabel = computed(() => {
  const total = selectedModelIdsList.value.length
  if (!total) return 'Starting…'
  return `Finished ${doneCount.value} of ${total} model${total === 1 ? '' : 's'}…`
})

const keepButtonLabel = computed(() => {
  if (panelPrefill.value?.sceneId && panelPrefill.value?.shotId) {
    return 'Keep clip & view storyboard panel'
  }
  if (selectedProjectId.value && saveToProject.value) {
    return 'Keep clip & open project video'
  }
  return 'Keep clip'
})

const selectedPlaybackUrl = computed(() => {
  const pick = selectedKeepModelId.value || successfulResults.value[0]?.modelId
  return successfulResults.value.find(r => r.modelId === pick)?.playbackUrl || ''
})

function modelSupportsLastFrame (m: VideoModel | undefined): boolean {
  if (!m) return false
  const frames = m.supportedFrameImages
  if (Array.isArray(frames) && frames.length) {
    return frames.includes('last_frame')
  }
  // Unknown catalog entry — allow end frame for known families that support it.
  const id = m.id.toLowerCase()
  return (
    id.startsWith('google/veo') ||
    id.startsWith('kwaivgi/kling') ||
    id.startsWith('bytedance/seedance') ||
    id === 'alibaba/wan-2.7'
  )
}

const anySelectedSupportsNegative = computed(() =>
  selectedModelIdsList.value.some(
    id => models.value.find(m => m.id === id)?.supportsNegativePrompt === true
  )
)

const anySelectedSupportsAudio = computed(() =>
  selectedModelIdsList.value.some(
    id => models.value.find(m => m.id === id)?.generateAudio === true
  )
)

const anySelectedSupportsEndFrame = computed(() =>
  selectedModelIdsList.value.some(id => modelSupportsLastFrame(models.value.find(m => m.id === id)))
)

const selectedLastFrameModels = computed(() =>
  selectedModelIdsList.value
    .map(id => models.value.find(m => m.id === id))
    .filter((m): m is VideoModel => Boolean(m) && modelSupportsLastFrame(m))
)

const selectedNonLastFrameModels = computed(() =>
  selectedModelIdsList.value
    .map(id => models.value.find(m => m.id === id))
    .filter((m): m is VideoModel => Boolean(m) && !modelSupportsLastFrame(m))
)

const endFrameCompatibilityWarn = computed(() =>
  Boolean(endFrameUrl.value && selectedModelIdsList.value.length && !selectedLastFrameModels.value.length)
)

const endFrameCompatibilityHint = computed(() => {
  if (!anySelectedSupportsEndFrame.value) return ''
  if (!endFrameUrl.value) {
    return 'Optional: add an ending frame for models that support Start + end frame.'
  }
  if (!selectedModelIdsList.value.length) {
    return 'Ending frame is set — choose a model that supports it.'
  }
  if (!selectedLastFrameModels.value.length) {
    const names = selectedNonLastFrameModels.value.map(m => m.name).join(', ')
    return `Ending frame won’t be sent — ${names || 'the selected model(s)'} only support a starting frame.`
  }
  if (selectedNonLastFrameModels.value.length) {
    const ok = selectedLastFrameModels.value.map(m => m.name).join(', ')
    const skip = selectedNonLastFrameModels.value.map(m => m.name).join(', ')
    return `Ending frame will be used for ${ok}. Skipped for ${skip}.`
  }
  return 'Ending frame will be sent to the selected model(s).'
})

const generatedAudioModelWarning = computed(() => {
  const wantsAudio = includeSpokenDialogue.value || includeAmbientSound.value
  if (!wantsAudio || !selectedModelIdsList.value.length) return ''
  const picked = selectedModelIdsList.value
    .map(id => models.value.find(m => m.id === id))
    .filter(Boolean) as VideoModel[]
  const withoutAudio = picked.filter(m => m.generateAudio !== true)
  if (!withoutAudio.length) return ''
  const kind = includeSpokenDialogue.value && includeAmbientSound.value
    ? 'dialogue and ambient sound'
    : includeSpokenDialogue.value
      ? 'spoken dialogue'
      : 'ambient sound'
  if (withoutAudio.length === picked.length) {
    return `None of your selected models are marked for native audio — try Wan 2.7, Seedance 1.5 Pro, or Veo 3.1, or turn off ${kind} for silent clips.`
  }
  return `${withoutAudio.map(m => m.name).join(', ')} may not synthesize ${kind} — prefer models with the Audio badge.`
})

const wantsGeneratedAudio = computed(
  () => includeSpokenDialogue.value || includeAmbientSound.value
)

const negativeDeliveryHint = computed(() => {
  const neg = negativePrompt.value.trim()
  if (!neg || !selectedModelIdsList.value.length) return ''
  const picked = selectedModelIdsList.value
    .map(id => models.value.find(m => m.id === id))
    .filter(Boolean) as VideoModel[]
  const native = picked.filter(m => m.supportsNegativePrompt === true)
  const fallback = picked.filter(m => m.supportsNegativePrompt !== true)
  if (native.length && !fallback.length) {
    return 'Selected models receive this as a native negative prompt (not mixed into the main prompt).'
  }
  if (!native.length && fallback.length) {
    return 'Selected models do not support native negatives — your avoid list is saved but not sent to these models (embedding exclusions in the prompt causes inverted results). Prefer Veo or Wan models with the Negatives badge.'
  }
  if (native.length && fallback.length) {
    return `${native.map(m => m.name).join(', ')} use native negatives; ${fallback.map(m => m.name).join(', ')} ignore the avoid list (no native support).`
  }
  return ''
})

function resolvedGenerationPrompt (): string {
  return resolveVideoGenerationUserPrompt({
    prompt: prompt.value,
    dialogueLine: dialogueLine.value,
    includeSpokenDialogue: includeSpokenDialogue.value,
    dialogueSpeakerName: dialogueSpeakerName.value,
    dialogueTone: dialogueTone.value,
    ambientSoundPrompt: ambientSoundPrompt.value,
    includeAmbientSound: includeAmbientSound.value
  })
}

const canSubmit = computed(() =>
  uiPhase.value === 'form' &&
  !generating.value &&
  !loadingPanelPrefill.value &&
  hasModelSelected.value &&
  prompt.value.trim().length > 0 &&
  !pending.value &&
  (!includeSpokenDialogue.value || (
    dialogueLine.value.trim().length > 0 &&
    (!dialogueSpeakerOptions.value.length || Boolean(dialogueSpeakerId.value))
  )) &&
  (!saveToProject.value || (selectedProjectId.value && pbProjects.value.some(p => p.id === selectedProjectId.value)))
)

function playbackSrc (url: string): string {
  void authTokenState.value
  return appendPlaybackAccessToken(url, getAuthToken())
}

function authHeaders (): Record<string, string> | null {
  const token = getAuthToken()
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

function clipTitle (): string {
  const fromPanel = (panelPrefill.value?.shotTitle || '').trim()
  if (fromPanel) return `${fromPanel} — video`.slice(0, 500)
  const base = prompt.value.trim().slice(0, 80) || 'Generated clip'
  return `${base} — video`.slice(0, 500)
}

function downloadFilenameForResult (result?: { modelName?: string }): string {
  const base = sanitizeDownloadFilename(clipTitle())
  const model = result?.modelName ? sanitizeDownloadFilename(result.modelName) : 'clip'
  return `${base}-${model}`
}

async function downloadClip (playbackUrl: string, result?: { modelName?: string }) {
  if (!playbackUrl || downloadingClip.value) return
  downloadingClip.value = true
  try {
    const src = playbackSrc(playbackUrl)
    const token = getAuthToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    await downloadMediaFile({
      url: src,
      filename: downloadFilenameForResult(result),
      headers
    })
    toast.showToast('Download started.', 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not download clip.'), 'error')
  } finally {
    downloadingClip.value = false
  }
}

async function downloadSelectedClip () {
  const pick = selectedKeepModelId.value || successfulResults.value[0]?.modelId
  const kept = successfulResults.value.find(r => r.modelId === pick)
  if (!kept?.playbackUrl) return
  await downloadClip(kept.playbackUrl, kept)
}

async function runOneModel (modelId: string) {
  const model = models.value.find(m => m.id === modelId)
  slotByModel[modelId] = { status: 'loading' }
  try {
    const { videoUrl } = await generateOpenRouterVideo({
      prompt: resolvedGenerationPrompt(),
      model: modelId,
      aspectRatio: aspectRatio.value,
      durationSeconds: durationSeconds.value,
      frameImageUrl: startFrameUrl.value || undefined,
      lastFrameImageUrl:
        modelSupportsLastFrame(model) && endFrameUrl.value
          ? endFrameUrl.value
          : undefined,
      supportedDurations: model?.supportedDurations,
      generateAudio: wantsGeneratedAudio.value,
      includeSpokenDialogue: includeSpokenDialogue.value,
      includeAmbientSound: includeAmbientSound.value,
      negativePrompt: negativePrompt.value.trim() || undefined
    })

    let playbackUrl = videoUrl
    const headers = authHeaders()

    if (saveToProject.value && selectedProjectId.value && headers) {
      const pre = panelPrefill.value
      const baseMetadata: Record<string, unknown> = {
        model_id: modelId,
        source: pre?.source || 'standalone_video_tool',
        aspect_ratio: aspectRatio.value,
        duration_seconds: durationSeconds.value,
        generate_audio: wantsGeneratedAudio.value,
        include_spoken_dialogue: includeSpokenDialogue.value,
        include_ambient_sound: includeAmbientSound.value,
        ...(includeSpokenDialogue.value && dialogueLine.value.trim()
          ? {
              dialogue_line: dialogueLine.value.trim().slice(0, 500),
              ...(dialogueSpeakerId.value
                ? { dialogue_speaker_id: dialogueSpeakerId.value }
                : {}),
              ...(dialogueSpeakerName.value
                ? { dialogue_speaker_name: dialogueSpeakerName.value.slice(0, 200) }
                : {}),
              ...(dialogueTone.value
                ? { dialogue_tone: dialogueTone.value.slice(0, 80) }
                : {})
            }
          : {}),
        ...(includeAmbientSound.value && ambientSoundPrompt.value.trim()
          ? { ambient_sound_prompt: ambientSoundPrompt.value.trim() }
          : {}),
        ...(negativePrompt.value.trim()
          ? { negative_prompt: negativePrompt.value.trim().slice(0, 4000) }
          : {}),
        ...(pre?.sceneId ? { scene_id: pre.sceneId } : {}),
        ...(pre?.shotId ? { shot_id: pre.shotId } : {})
      }
      const metadata = mergeGenerationObservabilityIntoMetadata(
        baseMetadata,
        buildGenerationObservability({
          generationPath: pre?.source === 'project_video_panel'
            ? GENERATION_PATH.PROJECT_VIDEO_PANEL
            : GENERATION_PATH.VIDEO_GENERATION,
          projectId: selectedProjectId.value,
          sceneId: pre?.sceneId,
          shotId: pre?.shotId,
          characterIds: effectiveCharacterIds.value.length
            ? effectiveCharacterIds.value
            : pre?.characterIds,
          model: modelId,
          provider: 'openrouter',
          promptForHash: resolvedGenerationPrompt(),
          bibleContext: pre?.productionBibleContext ?? null
        })
      )
      const asset = await saveVideoToProjectLibrary({
        projectId: selectedProjectId.value,
        remoteUrl: videoUrl,
        title: clipTitle(),
        notes: pre?.source === 'project_video_panel'
          ? 'Generated from project Storyboard via Video tools.'
          : 'Generated from Video tools (standalone).',
        metadata,
        headers
      })
      if (asset?.id) {
        playbackUrl = playbackUrlForProjectVideoAsset(selectedProjectId.value, asset.id)
        slotByModel[modelId] = {
          status: 'done',
          playbackUrl,
          assetId: asset.id
        }
      } else {
        toast.showToast(
          'Video rendered but saving to your library failed — clip may not play in-browser without saving.',
          'warning'
        )
        slotByModel[modelId] = { status: 'done', playbackUrl }
      }
    } else {
      slotByModel[modelId] = { status: 'done', playbackUrl }
    }

    doneCount.value += 1
  } catch (e: unknown) {
    slotByModel[modelId] = {
      status: 'error',
      error: formatApiFetchError(e, 'Generation failed')
    }
    doneCount.value += 1
  }
}

async function deleteRunAssets (assetIds: string[]) {
  const pid = selectedProjectId.value.trim()
  const headers = authHeaders()
  if (!pid || !headers || !assetIds.length) return
  await Promise.all(
    assetIds.map(id =>
      $fetch(`/api/projects/${pid}/assets/${id}`, { method: 'DELETE', headers }).catch(() => {})
    )
  )
}

function resetGenerationRun () {
  for (const id of selectedModelIdsList.value) {
    delete slotByModel[id]
  }
  doneCount.value = 0
  selectedKeepModelId.value = ''
  uiPhase.value = 'form'
}

async function discardRunAndRetry () {
  discardingRun.value = true
  try {
    const ids = successfulResults.value.map(r => r.assetId).filter(Boolean) as string[]
    await deleteRunAssets(ids)
    resetGenerationRun()
    toast.showToast('Clips discarded. Adjust settings and generate again.', 'info')
  } finally {
    discardingRun.value = false
  }
}

async function keepClipAndContinue () {
  const pick = selectedKeepModelId.value || successfulResults.value[0]?.modelId
  const kept = successfulResults.value.find(r => r.modelId === pick)
  if (!kept?.playbackUrl) return

  keepingClip.value = true
  try {
    const discardIds = successfulResults.value
      .filter(r => r.modelId !== pick && r.assetId)
      .map(r => r.assetId!)
    await deleteRunAssets(discardIds)

    const pid = selectedProjectId.value.trim()
    const pre = panelPrefill.value
    if (pid && pre?.sceneId && pre?.shotId) {
      toast.showToast('Clip saved to your storyboard.', 'success')
      await navigateTo({
        path: `/projects/${pid}/storyboard`,
        query: { sceneId: pre.sceneId, shotId: pre.shotId }
      })
      return
    }
    if (pid && saveToProject.value) {
      toast.showToast('Clip saved to your project.', 'success')
      await navigateTo(`/projects/${pid}/storyboard`)
      return
    }
    toast.showToast('Clip kept.', 'success')
    resetGenerationRun()
  } finally {
    keepingClip.value = false
  }
}

async function onSubmit () {
  formError.value = ''
  if (!primaryModelId.value) {
    formError.value = 'Select a model.'
    return
  }
  if (!prompt.value.trim()) {
    formError.value = 'Enter a prompt.'
    return
  }
  if (includeSpokenDialogue.value) {
    if (!dialogueLine.value.trim()) {
      formError.value = 'Enter the spoken dialogue line.'
      return
    }
    if (dialogueSpeakerOptions.value.length && !dialogueSpeakerId.value) {
      formError.value = 'Choose which character speaks the line.'
      return
    }
  }
  if (saveToProject.value) {
    if (!isAuthenticated.value) {
      formError.value = 'Sign in to save clips to a project.'
      return
    }
    await initAuth()
    if (!selectedProjectId.value) {
      formError.value = 'Choose a project to save into.'
      return
    }
  }

  persistVideoGenerationPrefs()

  generating.value = true
  uiPhase.value = 'generating'
  doneCount.value = 0
  for (const id of selectedModelIdsList.value) {
    delete slotByModel[id]
  }
  for (const id of selectedModelIdsList.value) {
    slotByModel[id] = { status: 'loading' }
  }

  await Promise.all(selectedModelIdsList.value.map(id => runOneModel(id)))

  generating.value = false
  uiPhase.value = 'complete'
  const firstOk = successfulResults.value[0]?.modelId
  if (firstOk) selectedKeepModelId.value = firstOk

  const anyOk = successfulResults.value.length > 0
  if (!anyOk) {
    toast.showToast('All models failed — adjust prompt or try another model.', 'error')
  }
}

useHead({
  title: 'Video generation — AI Elegance',
  meta: [{ name: 'description', content: 'Select video models and describe your shot on AI Elegance.' }]
})
</script>
