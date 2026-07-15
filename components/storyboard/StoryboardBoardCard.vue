<template>
  <li
    class="relative rounded-xl border bg-white overflow-hidden flex flex-col shadow-sm transition-all"
    :class="[
      draggingShotId === shot.id ? 'opacity-40 border-gray-300' : 'border-gray-200',
      draggingShotId && draggingShotId !== shot.id && dropTargetIndex === index
        ? 'ring-2 ring-primary ring-offset-2'
        : '',
      reordering ? 'pointer-events-none' : ''
    ]"
    :draggable="armedShotId === shot.id"
    @dragstart="onBoardDragStart(shot.id, $event)"
    @dragend="onBoardDragEnd"
    @dragover="onDropSlotDragOver(index, $event)"
    @dragleave="onDropSlotDragLeave(index)"
    @drop="onDropAtSlot(index, $event)"
  >
    <div class="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="shrink-0 px-1 py-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 select-none"
          :class="reordering || !!imageGenId || !!frameUploadingId
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-grab active:cursor-grabbing'"
          title="Drag to reorder"
          aria-label="Drag to reorder board"
          @mousedown="onGripPress(shot.id)"
          @touchstart="onGripPress(shot.id)"
        >
          <svg class="w-4 h-4 pointer-events-none" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="4" r="1.2" />
            <circle cx="11" cy="4" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="11" cy="12" r="1.2" />
          </svg>
        </span>
        <span class="text-xs font-mono text-primary">BOARD {{ index + 1 }}</span>
      </div>
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs text-gray-500 truncate max-w-[12rem] sm:max-w-[55%] text-right">{{ shot.title || 'Untitled' }}</span>
        <button
          v-if="shotsLength > 1"
          type="button"
          class="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
          :disabled="deletingBoardId === shot.id || reordering"
          @click="onDeleteBoard(shot)"
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
        @click="onOpenFramePreview(shot)"
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
              @click="onTriggerStoryboardUpload(shot)"
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
              @click="onGenerateFrame(shot)"
            >
              Generate
            </button>
          </div>
          <p
            v-if="frameBibleDebug[shot.id]"
            class="mt-2 text-[10px] text-gray-500 text-center px-2"
          >
            {{ frameBibleDebug[shot.id] }}
          </p>
        </template>
      </div>
      <button
        v-if="panelImageSrc(shot)"
        type="button"
        class="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] font-semibold rounded-md bg-gray-950/75 text-white hover:bg-red-700 border border-white/20 disabled:opacity-50"
        :disabled="frameDeletingId === shot.id"
        :aria-label="`Remove frame for ${shot.title || 'board'}`"
        @click.stop="onClearStoryboardFrame(shot)"
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
        @click="onTriggerStoryboardUpload(shot)"
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
        @click="onGenerateFrame(shot)"
      >
        {{ imageGenId === shot.id ? 'Generating…' : 'Regenerate' }}
      </button>
      <span class="text-[11px] text-gray-500 ml-auto hidden sm:inline">
        {{ shot.shotType || 'Shot' }} · {{ shot.durationSeconds }}s
      </span>
    </div>
    <div
      v-if="shotCharacterMatches(shot).length"
      class="px-3 py-1.5 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white shrink-0"
    >
      <span class="text-[10px] font-medium text-gray-400 uppercase tracking-wide shrink-0">Cast</span>
      <ul class="flex flex-wrap gap-1">
        <li
          v-for="c in shotCharacterMatches(shot)"
          :key="`chip-${c.id}`"
        >
          <NuxtLink
            :to="characterProfileTo(c)"
            class="block w-7 h-7 rounded overflow-hidden border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-primary/50 transition-shadow"
            :title="c.name"
          >
            <img
              v-if="c.portraitUrl"
              :src="c.portraitUrl"
              :alt="c.name"
              class="w-full h-full object-cover"
            >
            <span
              v-else
              class="flex h-full w-full items-center justify-center text-[8px] font-bold text-gray-500 uppercase"
            >
              {{ c.name.trim().slice(0, 2) }}
            </span>
          </NuxtLink>
        </li>
      </ul>
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
        <p
          v-if="frameBibleDebug[shot.id]"
          class="text-[10px] text-gray-500"
        >
          {{ frameBibleDebug[shot.id] }}
        </p>
        <div
          v-if="!hasDisplayableFrame(shot) && !framePreviewLoading[shot.id]"
          class="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-45"
            :disabled="frameUploadingId === shot.id || imageGenId === shot.id"
            @click="onTriggerStoryboardUpload(shot)"
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
            @click="onGenerateFrame(shot)"
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
            @blur="onSaveShot(shot)"
          >
        </div>
        <div>
          <div class="flex justify-between items-start gap-2 mb-1">
            <label class="text-xs font-medium text-gray-500">Story beat (short)</label>
            <PromptEnhanceButton v-model="shot.description" context="story" />
          </div>
          <p class="text-[10px] text-gray-400 mb-1">
            One-line beat for the board list. Cast names auto-capitalize (DOG, CAT) — ALL CAPS means use that character's design, not a generic animal.
          </p>
          <textarea
            v-model="shot.description"
            rows="2"
            class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y min-h-[3rem]"
            @blur="onSaveShot(shot)"
          />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
            <input
              v-model="shot.shotType"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              @blur="onSaveShot(shot)"
            >
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Camera</label>
            <input
              v-model="shot.cameraMove"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              @blur="onSaveShot(shot)"
            >
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Clip (video)</label>
            <select
              v-model.number="shot.durationSeconds"
              class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              @change="onSaveShot(shot)"
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
        <div
          v-if="shotCharacterMatches(shot).length"
          class="flex flex-col gap-1.5 pt-1"
        >
          <p class="text-[11px] font-medium text-gray-500">
            In this shot
          </p>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="c in shotCharacterMatches(shot)"
              :key="c.id"
            >
              <NuxtLink
                :to="characterProfileTo(c)"
                class="group flex flex-col items-center gap-0.5 w-11"
                :title="`Open ${c.name} profile${c.portraitUrl ? ' · portrait attached' : ''}`"
              >
                <span
                  class="relative block w-9 h-9 rounded-md overflow-hidden border border-gray-200 bg-gray-100 shadow-sm group-hover:ring-2 group-hover:ring-primary/50 transition-shadow"
                >
                  <img
                    v-if="c.portraitUrl"
                    :src="c.portraitUrl"
                    :alt="c.name"
                    class="absolute inset-0 w-full h-full object-cover"
                  >
                  <span
                    v-else
                    class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-500 uppercase tracking-tight"
                  >
                    {{ c.name.trim().slice(0, 2) }}
                  </span>
                </span>
                <span class="text-[9px] font-semibold text-gray-600 uppercase truncate max-w-[2.75rem] group-hover:text-primary leading-tight">
                  {{ c.name.trim() }}
                </span>
              </NuxtLink>
            </li>
          </ul>
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
            @blur="onSaveShot(shot)"
          />
          <p class="mt-1.5 text-[11px] text-gray-500 leading-snug">
            Used for Generate image and the Video step.
          </p>
        </div>
      </div>
    </details>
  </li>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'

defineProps<{
  shot: CreativeShot
  index: number
  shotsLength: number
  draggingShotId: string | null
  dropTargetIndex: number | null
  reordering: boolean
  armedShotId: string | null
  imageGenId: string | null
  frameUploadingId: string | null
  frameDeletingId: string | null
  deletingBoardId: string | null
  generatingAllFrames: boolean
  framePreviewBoxClass: string
  framePreviewLoading: Record<string, boolean>
  framePreviewFailed: Record<string, boolean>
  frameBibleDebug: Record<string, string>
  activeImageModelLabel: string
  panelImageSrc: (shot: CreativeShot) => string
  hasDisplayableFrame: (shot: CreativeShot) => boolean
  shotCharacterMatches: (shot: CreativeShot) => ProjectCharacterRef[]
  characterProfileTo: (c: ProjectCharacterRef) => string
  boardDetailsOpenFor: (shot: CreativeShot) => boolean
  onBoardDragStart: (shotId: string, event: DragEvent) => void
  onBoardDragEnd: () => void
  onDropSlotDragOver: (index: number, event: DragEvent) => void
  onDropSlotDragLeave: (index: number) => void
  onDropAtSlot: (index: number, event: DragEvent) => void
  onGripPress: (shotId: string) => void
  onDeleteBoard: (shot: CreativeShot) => void
  onOpenFramePreview: (shot: CreativeShot) => void
  onFramePreviewImgError: (shot: CreativeShot) => void
  onTriggerStoryboardUpload: (shot: CreativeShot) => void
  onGenerateFrame: (shot: CreativeShot) => void
  onClearStoryboardFrame: (shot: CreativeShot) => void
  onBoardDetailsToggle: (event: Event, shot: CreativeShot) => void
  onSaveShot: (shot: CreativeShot) => void
}>()
</script>
