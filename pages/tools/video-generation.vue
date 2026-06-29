<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Video generation
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Clips are silent by default (no AI background music) — add score on the timeline later. Optionally add <span class="font-medium text-gray-800">spoken dialogue</span> or <span class="font-medium text-gray-800">ambient sound</span> (rain, hallway echo, etc.) for models that support audio.
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
                Keep saves this clip to your storyboard panel on the Video step. Discard removes it so you can adjust settings and try again.
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
        <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Video
          </h2>
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
              placeholder="Motion, camera, lighting, mood — no music (add score on the timeline later)"
            />
            <p
              v-if="productionBibleDebugLine"
              class="mt-1.5 text-xs text-gray-500"
            >
              {{ productionBibleDebugLine }}
            </p>
          </div>
          <div>
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
            :prompt="prompt"
            :aspect-ratio="aspectRatio"
            :bible-project-id="startFrameBibleProjectId"
            :bible-scene-id="panelPrefill?.sceneId"
            :bible-shot-id="panelPrefill?.shotId"
            :bible-character-ids="panelPrefill?.characterIds"
          />
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
                <option :value="5">5 seconds</option>
                <option :value="10">10 seconds</option>
              </select>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-3">
            <label class="inline-flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="includeSpokenDialogue"
                type="checkbox"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span>
                <span class="font-medium text-gray-900">Include spoken dialogue</span>
                <span class="block text-xs text-gray-500 mt-0.5">
                  Quick talking clips — the model synthesizes speech in the video file (no background music).
                  Works best with models marked <span class="font-medium text-gray-700">Audio</span> below.
                </span>
              </span>
            </label>
            <div v-if="includeSpokenDialogue">
              <label for="vg-dialogue" class="block text-sm font-medium text-gray-700 mb-1.5">What they say</label>
              <textarea
                id="vg-dialogue"
                v-model="dialogueLine"
                rows="2"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                placeholder='e.g. "We have to leave — now."'
              />
              <p class="mt-1.5 text-xs text-gray-500">
                Optional if the line is already in your prompt above. Lip-sync quality varies by model.
              </p>
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
                  Diegetic in-scene sound — rain, wind, hallway echo, office hum, crowd murmur. Still no musical score.
                </span>
              </span>
            </label>
            <div v-if="includeAmbientSound">
              <label for="vg-ambient" class="block text-sm font-medium text-gray-700 mb-1.5">Soundscape</label>
              <textarea
                id="vg-ambient"
                v-model="ambientSoundPrompt"
                rows="2"
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
                placeholder="e.g. Soft rain on leaves, distant thunder, quiet forest birdsong"
              />
              <div class="flex flex-wrap gap-1.5 mt-2">
                <button
                  v-for="preset in ambientSoundPresets"
                  :key="preset"
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
            By default clips are silent — add score on the timeline later. Dialogue and ambient options ask the model to synthesize sound in the file (still no AI background music).
            Video on OpenRouter is API-only and may be in alpha.
            <a
              href="https://openrouter.ai/models?fmt=cards&output_modalities=video"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >Browse models on OpenRouter</a>.
          </p>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Save to project
          </h2>
          <p v-if="!isAuthenticated" class="text-sm text-amber-800">
            <NuxtLink to="/login" class="text-primary font-medium underline">Sign in</NuxtLink>
            to save clips to a project library and timeline.
          </p>
          <template v-else>
            <label class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="saveToProject"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
              >
              Save to project library (Assets → Video)
            </label>
            <div v-if="saveToProject">
              <label for="vg-project" class="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
              <div class="flex flex-wrap items-end gap-2">
                <select
                  id="vg-project"
                  v-model="selectedProjectId"
                  required
                  class="flex-1 min-w-[12rem] sm:max-w-md px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="" disabled>Select project</option>
                  <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                    {{ p.name }}
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
                No projects yet — use <span class="font-medium text-gray-800">+ New project</span> to create one here.
              </p>
            </div>
            <label
              class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
              :class="{ 'opacity-50 pointer-events-none': !saveToProject || !selectedProjectId }"
            >
              <input
                v-model="addToTimeline"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
                :disabled="!saveToProject || !selectedProjectId"
              >
              Add to project timeline after each clip is saved
            </label>
          </template>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Models
          </h2>
          <p class="text-xs text-gray-500 mb-4">
            Select one or more; generations run in parallel.
            <span v-if="data?.source === 'api'" class="block sm:inline sm:ml-1 mt-1 sm:mt-0">
              Live list (<code class="rounded bg-gray-100 px-1 py-0.5 text-gray-800">output_modalities=video</code>).
            </span>
          </p>
          <div v-if="!models.length" class="text-sm text-gray-500 py-2">
            No models loaded.
          </div>
          <div v-else class="flex flex-wrap gap-3">
            <label
              v-for="m in models"
              :key="m.id"
              class="inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 max-w-full sm:max-w-[calc(50%-0.375rem)]"
            >
              <input
                v-model="selectedModelIds"
                type="checkbox"
                :value="m.id"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span class="min-w-0">
                <span class="block text-sm text-gray-800 font-medium leading-snug">
                  {{ m.name }}
                  <span
                    v-if="m.generateAudio"
                    class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary border border-primary/25 align-middle"
                  >Audio</span>
                  <span
                    v-if="m.supportsNegativePrompt"
                    class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-800 border border-violet-200 align-middle"
                    title="Supports native negative prompt via OpenRouter"
                  >Negatives</span>
                </span>
                <span class="block text-xs font-mono text-gray-500 truncate mt-0.5" :title="m.id">{{ m.id }}</span>
                <span
                  v-if="m.description"
                  class="block text-xs text-gray-500 line-clamp-2 mt-1"
                >{{ m.description }}</span>
              </span>
            </label>
          </div>
        </section>

        <div v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </div>

        <div>
          <button
            type="submit"
            class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSubmit"
          >
            {{ generating ? `Generating… ${doneCount}/${selectedModelIds.length}` : 'Generate Video' }}
          </button>
        </div>
      </form>

      <section v-if="uiPhase === 'form' && hasAnySlot" class="space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Results</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <article
            v-for="m in models"
            v-show="selectedModelIds.includes(m.id) && slotByModel[m.id]"
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
                v-if="selectedProjectId && saveToProject"
                :to="`/projects/${selectedProjectId}/timeline`"
                class="text-xs font-medium text-primary hover:underline"
              >
                Open timeline
              </NuxtLink>
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

import { appendVideoToProjectTimeline } from '~/lib/append-project-timeline-video'
import { timelineAppendToast } from '~/lib/timeline-append-feedback'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
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
import type { CreativeProject, ProjectAspectRatio } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

type VideoModel = {
  id: string
  name: string
  description?: string
  supportedDurations?: number[]
  generateAudio?: boolean
  supportsNegativePrompt?: boolean
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
const aspectRatio = ref<'16:9' | '9:16' | '1:1'>(boot?.aspectRatio ?? '16:9')
const durationSeconds = ref(
  typeof boot?.durationSeconds === 'number' &&
    (boot.durationSeconds === 5 || boot.durationSeconds === 10)
    ? boot.durationSeconds
    : 5
)
const includeSpokenDialogue = ref(false)
const dialogueLine = ref('')
const includeAmbientSound = ref(false)
const ambientSoundPrompt = ref('')

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
const selectedModelIds = ref<string[]>([])
const formError = ref('')
const generating = ref(false)
const doneCount = ref(0)
const saveToProject = ref(boot?.saveToProject ?? true)
const addToTimeline = ref(boot?.addToTimeline ?? false)
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
const prefillBanner = ref(
  boot?.shotTitle?.trim()
    ? `Opened from project storyboard — “${boot.shotTitle.trim()}”. Prompt, negative prompt, and seed frame are prefilled; pick one or more models below.`
    : boot?.prompt?.trim()
      ? 'Opened from a project panel — prompt, negative prompt, and seed frame are prefilled; pick one or more models below.'
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
  if (!selectedProjectId.value && pbProjects.value.length) {
    selectedProjectId.value = pbProjects.value[0].id
  }
}, { immediate: true })

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
  if (p.aspectRatio) aspectRatio.value = p.aspectRatio
  if (typeof p.durationSeconds === 'number' && (p.durationSeconds === 5 || p.durationSeconds === 10)) {
    durationSeconds.value = p.durationSeconds
  }
  if (p.saveToProject !== undefined) saveToProject.value = p.saveToProject
  if (p.addToTimeline !== undefined) addToTimeline.value = p.addToTimeline
  if (p.projectId && PB_ID.test(p.projectId)) {
    pinnedProjectId.value = p.projectId
    selectedProjectId.value = p.projectId
    saveToProject.value = true
    syncSelectedProjectFromPin()
  }
  const label = (p.shotTitle || '').trim()
  prefillBanner.value = label
    ? `Opened from project storyboard — “${label}”. Prompt, negative prompt, and seed frame are prefilled; pick one or more models below.`
    : 'Opened from a project panel — prompt, negative prompt, and seed frame are prefilled; pick one or more models below.'
}

function stripPanelQueryFromRoute () {
  if (!import.meta.client) return
  const q = { ...route.query }
  let changed = false
  for (const key of ['projectId', 'sceneId', 'shotId', 'addToTimeline'] as const) {
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
    const addFromQuery = route.query.addToTimeline === '1'
    applyVideoGenerationPrefill({
      ...res,
      addToTimeline: addFromQuery || res.addToTimeline
    })
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
  if (!tryApplyStashedPrefill() && hasPanelDeepLink.value) {
    await fetchPanelPrefillFromApi()
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

watch(saveToProject, (v) => {
  if (!v) addToTimeline.value = false
})

const hasAnySlot = computed(() => Object.keys(slotByModel).length > 0)

const successfulResults = computed(() =>
  selectedModelIds.value
    .filter(id => slotByModel[id]?.status === 'done' && slotByModel[id]?.playbackUrl)
    .map(id => ({
      modelId: id,
      modelName: models.value.find(m => m.id === id)?.name || id,
      playbackUrl: slotByModel[id]!.playbackUrl!,
      assetId: slotByModel[id]?.assetId
    }))
)

const failedResults = computed(() =>
  selectedModelIds.value
    .filter(id => slotByModel[id]?.status === 'error')
    .map(id => ({
      modelId: id,
      modelName: models.value.find(m => m.id === id)?.name || id,
      error: slotByModel[id]?.error || 'Generation failed'
    }))
)

const generatingSubLabel = computed(() => {
  const total = selectedModelIds.value.length
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

const generatedAudioModelWarning = computed(() => {
  const wantsAudio = includeSpokenDialogue.value || includeAmbientSound.value
  if (!wantsAudio || !selectedModelIds.value.length) return ''
  const picked = selectedModelIds.value
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
    return `None of your selected models are marked for native audio — try Wan 2.6, Seedance 1.5 Pro, or Veo 3.1, or turn off ${kind} for silent clips.`
  }
  return `${withoutAudio.map(m => m.name).join(', ')} may not synthesize ${kind} — prefer models with the Audio badge.`
})

const wantsGeneratedAudio = computed(
  () => includeSpokenDialogue.value || includeAmbientSound.value
)

const negativeDeliveryHint = computed(() => {
  const neg = negativePrompt.value.trim()
  if (!neg || !selectedModelIds.value.length) return ''
  const picked = selectedModelIds.value
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
    ambientSoundPrompt: ambientSoundPrompt.value,
    includeAmbientSound: includeAmbientSound.value
  })
}

const canSubmit = computed(() =>
  uiPhase.value === 'form' &&
  !generating.value &&
  !loadingPanelPrefill.value &&
  selectedModelIds.value.length > 0 &&
  prompt.value.trim().length > 0 &&
  !pending.value &&
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
          ? { dialogue_line: dialogueLine.value.trim().slice(0, 500) }
          : {}),
        ...(includeAmbientSound.value && ambientSoundPrompt.value.trim()
          ? { ambient_sound_prompt: ambientSoundPrompt.value.trim().slice(0, 500) }
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
          characterIds: pre?.characterIds,
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
          ? 'Generated from project Video step via Video tools.'
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
  for (const id of selectedModelIds.value) {
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

    if (addToTimeline.value && selectedProjectId.value) {
      const appendResult = await appendVideoToProjectTimeline(selectedProjectId.value, {
        url: playbackSrc(kept.playbackUrl),
        label: clipTitle(),
        assetId: kept.assetId,
        ...(panelPrefill.value?.sceneId ? { sceneId: panelPrefill.value.sceneId } : {}),
        ...(panelPrefill.value?.shotId ? { shotId: panelPrefill.value.shotId } : {})
      }, { authHeaders: pocketBaseBearerHeaders(getAuthToken()) })
      const t = timelineAppendToast(appendResult.outcome, 'video')
      toast.showToast(t.message, t.type)
    }

    const pid = selectedProjectId.value.trim()
    const pre = panelPrefill.value
    if (pid && pre?.sceneId && pre?.shotId) {
      toast.showToast('Clip saved to your storyboard panel.', 'success')
      await navigateTo({
        path: `/projects/${pid}/video`,
        query: { sceneId: pre.sceneId, shotId: pre.shotId }
      })
      return
    }
    if (pid && saveToProject.value) {
      toast.showToast('Clip saved to your project.', 'success')
      await navigateTo(`/projects/${pid}/video`)
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
  if (!prompt.value.trim()) {
    formError.value = 'Enter a prompt.'
    return
  }
  if (!selectedModelIds.value.length) {
    formError.value = 'Select at least one model.'
    return
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

  generating.value = true
  uiPhase.value = 'generating'
  doneCount.value = 0
  for (const id of selectedModelIds.value) {
    delete slotByModel[id]
  }
  for (const id of selectedModelIds.value) {
    slotByModel[id] = { status: 'loading' }
  }

  await Promise.all(selectedModelIds.value.map(id => runOneModel(id)))

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
