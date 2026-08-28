<template>
  <li
    class="relative rounded-xl border bg-studio-slate overflow-hidden flex flex-col shadow-sm transition-all"
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
      class="grid grid-cols-2 gap-px bg-gray-200 border-b border-gray-200 shrink-0"
      :class="!hasAnyDisplayableFrame(shot) ? 'border-b-gray-300' : ''"
    >
      <StoryboardPanelFrame
        :shot="shot"
        role="start"
        :frame-preview-box-class="framePreviewBoxClass"
        :image-gen-id="imageGenId"
        :frame-uploading-id="frameUploadingId"
        :frame-deleting-id="frameDeletingId"
        :generating-all-frames="generatingAllFrames"
        :frame-preview-loading="framePreviewLoading"
        :frame-preview-failed="framePreviewFailed"
        :panel-image-src="panelImageSrc"
        :has-displayable-frame="hasDisplayableFrame"
        :can-generate="canGenerateFrame"
        :on-open-frame-preview="onOpenFramePreview"
        :on-frame-preview-img-error="onFramePreviewImgError"
        :on-trigger-storyboard-upload="onTriggerStoryboardUpload"
        :on-generate-frame="onGenerateFrame"
        :on-clear-storyboard-frame="onClearStoryboardFrame"
      />
      <StoryboardPanelFrame
        :shot="shot"
        role="end"
        :frame-preview-box-class="framePreviewBoxClass"
        :image-gen-id="imageGenId"
        :frame-uploading-id="frameUploadingId"
        :frame-deleting-id="frameDeletingId"
        :generating-all-frames="generatingAllFrames"
        :frame-preview-loading="framePreviewLoading"
        :frame-preview-failed="framePreviewFailed"
        :panel-image-src="panelImageSrc"
        :has-displayable-frame="hasDisplayableFrame"
        :can-generate="canGenerateFrame"
        :on-open-frame-preview="onOpenFramePreview"
        :on-frame-preview-img-error="onFramePreviewImgError"
        :on-trigger-storyboard-upload="onTriggerStoryboardUpload"
        :on-generate-frame="onGenerateFrame"
        :on-clear-storyboard-frame="onClearStoryboardFrame"
      />
    </div>

    <div
      v-if="hasAnyDisplayableFrame(shot)"
      class="px-3 py-2 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 shrink-0"
    >
      <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Frames</span>
      <template v-for="role in (['start', 'end'] as const)" :key="role">
        <button
          v-if="hasDisplayableFrame(shot, role)"
          type="button"
          class="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-300 bg-studio-slate text-gray-800 hover:bg-gray-100 disabled:opacity-45"
          :disabled="isSlotBusy(shot, role)"
          @click="onTriggerStoryboardUpload(shot, role)"
        >
          {{ frameUploadingId === frameSlotKey(shot, role) ? 'Uploading…' : `Replace ${role}` }}
        </button>
        <button
          type="button"
          class="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
          :disabled="isSlotBusy(shot, role) || generatingAllFrames || !canGenerateFrame(shot, role)"
          @click="onGenerateFrame(shot, role)"
        >
          {{ imageGenId === frameSlotKey(shot, role) ? 'Generating…' : `Regen ${role}` }}
        </button>
      </template>
      <span class="text-[11px] text-gray-500 ml-auto hidden sm:inline">
        {{ shot.shotType || 'Shot' }} · {{ shot.durationSeconds }}s
      </span>
    </div>

    <div
      v-if="hasDisplayableFrame(shot, 'start') && hasDisplayableFrame(shot, 'end')"
      class="px-3 py-2.5 border-b border-gray-100 bg-studio-slate shrink-0 space-y-1.5"
    >
      <button
        type="button"
        class="w-full px-3 py-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 transition-colors disabled:opacity-45"
        :disabled="openingVideoShotId === shot.id || generatingAllFrames || !!imageGenId || !!frameUploadingId"
        @click="onGenerateVideo(shot)"
      >
        {{ openingVideoShotId === shot.id ? 'Opening video tool…' : 'Generate video' }}
      </button>
      <button
        type="button"
        class="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:border-primary/50 transition-colors disabled:opacity-45"
        :disabled="openingFixShotId === shot.id || generatingAllFrames"
        @click="onFixShot(shot)"
      >
        {{ openingFixShotId === shot.id ? 'Opening Fix Shot…' : 'Fix Shot' }}
      </button>
      <p class="text-[11px] text-gray-500 leading-snug">
        Start and end frames are ready — generate a new clip, or repair an existing one without regenerating the whole shot.
      </p>
    </div>

    <div
      v-if="shotCharacterMatches(shot).length"
      class="px-3 py-1.5 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-studio-slate shrink-0"
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
          v-if="!hasDisplayableFrame(shot, 'start') && !framePreviewLoading[frameSlotKey(shot, 'start')]"
          class="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-studio-slate text-gray-800 hover:bg-gray-50 disabled:opacity-45"
            :disabled="isSlotBusy(shot, 'start')"
            @click="onTriggerStoryboardUpload(shot, 'start')"
          >
            {{ frameUploadingId === frameSlotKey(shot, 'start') ? 'Uploading…' : 'Upload start frame' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
            :disabled="isSlotBusy(shot, 'start') || generatingAllFrames || !canGenerateFrame(shot, 'start')"
            @click="onGenerateFrame(shot, 'start')"
          >
            {{ imageGenId === frameSlotKey(shot, 'start') ? 'Generating…' : `Generate start (${activeImageModelLabel})` }}
          </button>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Board title</label>
          <input
            v-model="shot.title"
            type="text"
            class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
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
            class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y min-h-[3rem]"
            @blur="onSaveShot(shot)"
          />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Type</label>
            <input
              v-model="shot.shotType"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              @blur="onSaveShot(shot)"
            >
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Camera</label>
            <input
              v-model="shot.cameraMove"
              type="text"
              class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
              @blur="onSaveShot(shot)"
            >
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Clip (video)</label>
            <select
              v-model.number="shot.durationSeconds"
              class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
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
            class="w-full px-3 py-2 rounded-lg bg-studio-slate border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y font-mono text-[13px] leading-relaxed"
            @blur="onSaveShot(shot)"
          />
          <p class="mt-1.5 text-[11px] text-gray-500 leading-snug">
            Used for Generate image and the Video step. End frames finish this clip’s beat and use the start frame as a reference when available.
          </p>
        </div>
      </div>
    </details>
  </li>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'
import type { ProjectCharacterRef } from '~/lib/shot-character-continuity'
import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'
import StoryboardPanelFrame from '~/components/storyboard/StoryboardPanelFrame.vue'

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
  openingVideoShotId: string | null
  openingFixShotId?: string | null
  framePreviewBoxClass: string
  framePreviewLoading: Record<string, boolean>
  framePreviewFailed: Record<string, boolean>
  frameBibleDebug: Record<string, string>
  activeImageModelLabel: string
  panelImageSrc: (shot: CreativeShot, role: StoryboardFrameRole) => string
  hasDisplayableFrame: (shot: CreativeShot, role: StoryboardFrameRole) => boolean
  hasAnyDisplayableFrame: (shot: CreativeShot) => boolean
  canGenerateFrame: (shot: CreativeShot, role: StoryboardFrameRole) => boolean
  isSlotBusy: (shot: CreativeShot, role: StoryboardFrameRole) => boolean
  frameSlotKey: (shot: CreativeShot, role: StoryboardFrameRole) => string
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
  onOpenFramePreview: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onFramePreviewImgError: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onTriggerStoryboardUpload: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onGenerateFrame: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onClearStoryboardFrame: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onGenerateVideo: (shot: CreativeShot) => void
  onFixShot: (shot: CreativeShot) => void
  onBoardDetailsToggle: (event: Event, shot: CreativeShot) => void
  onSaveShot: (shot: CreativeShot) => void
}>()
</script>
