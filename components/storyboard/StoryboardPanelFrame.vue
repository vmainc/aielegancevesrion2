<template>
  <div
    :class="[
      framePreviewBoxClass,
      'relative shrink-0 w-full rounded-none border-0 bg-gray-900',
      !hasDisplayableFrame(shot, role) && !framePreviewLoading[slotKey(shot, role)]
        ? 'border-dashed border-gray-600'
        : ''
    ]"
  >
    <p class="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-gray-950/80 text-gray-200 pointer-events-none">
      {{ roleLabel }}
    </p>
    <button
      v-if="panelImageSrc(shot, role)"
      type="button"
      class="absolute inset-0 w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      :aria-label="`View full size: ${shot.title || 'storyboard'} ${roleLabel}`"
      @click="onOpenFramePreview(shot, role)"
    >
      <img
        :key="`${slotKey(shot, role)}-${panelImageSrc(shot, role).slice(0, 80)}`"
        :src="panelImageSrc(shot, role)"
        :alt="`${shot.title || 'Storyboard'} ${roleLabel}`"
        class="absolute inset-0 w-full h-full object-contain object-center pointer-events-none"
        loading="eager"
        @error="onFramePreviewImgError(shot, role)"
      >
    </button>
    <div
      v-else-if="framePreviewLoading[slotKey(shot, role)] || imageGenId === slotKey(shot, role) || frameUploadingId === slotKey(shot, role)"
      class="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10"
    >
      <FilmReelLoader
        size="sm"
        :label="frameUploadingId === slotKey(shot, role) ? 'Uploading…' : imageGenId === slotKey(shot, role) ? 'Generating…' : 'Loading…'"
      />
    </div>
    <div
      v-else
      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center"
    >
      <p v-if="framePreviewFailed[slotKey(shot, role)]" class="text-[10px] text-amber-300 leading-snug">
        Could not load — try again.
      </p>
      <template v-else>
        <p class="text-[10px] text-gray-400">
          No {{ role === 'start' ? 'start' : 'end' }} frame
        </p>
        <div class="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            class="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700 disabled:opacity-45"
            :disabled="frameUploadingId === slotKey(shot, role) || imageGenId === slotKey(shot, role)"
            @click="onTriggerStoryboardUpload(shot, role)"
          >
            Upload
          </button>
          <button
            type="button"
            class="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary hover:bg-primary/90 text-gray-950 disabled:opacity-45"
            :disabled="
              imageGenId === slotKey(shot, role) ||
              frameUploadingId === slotKey(shot, role) ||
              generatingAllFrames ||
              !canGenerate(shot, role)
            "
            @click="onGenerateFrame(shot, role)"
          >
            Generate
          </button>
        </div>
      </template>
    </div>
    <button
      v-if="panelImageSrc(shot, role)"
      type="button"
      class="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-950/75 text-white hover:bg-red-700 border border-white/20 disabled:opacity-50"
      :disabled="frameDeletingId === slotKey(shot, role)"
      :aria-label="`Remove ${roleLabel} for ${shot.title || 'board'}`"
      @click.stop="onClearStoryboardFrame(shot, role)"
    >
      {{ frameDeletingId === slotKey(shot, role) ? '…' : '×' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CreativeShot } from '~/types/creative-shot'
import type { StoryboardFrameRole } from '~/lib/storyboard-frame-role'
import { storyboardFrameRoleLabel, storyboardFrameSlotKey } from '~/lib/storyboard-frame-role'

const props = defineProps<{
  shot: CreativeShot
  role: StoryboardFrameRole
  framePreviewBoxClass: string
  imageGenId: string | null
  frameUploadingId: string | null
  frameDeletingId: string | null
  generatingAllFrames: boolean
  framePreviewLoading: Record<string, boolean>
  framePreviewFailed: Record<string, boolean>
  panelImageSrc: (shot: CreativeShot, role: StoryboardFrameRole) => string
  hasDisplayableFrame: (shot: CreativeShot, role: StoryboardFrameRole) => boolean
  canGenerate: (shot: CreativeShot, role: StoryboardFrameRole) => boolean
  onOpenFramePreview: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onFramePreviewImgError: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onTriggerStoryboardUpload: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onGenerateFrame: (shot: CreativeShot, role: StoryboardFrameRole) => void
  onClearStoryboardFrame: (shot: CreativeShot, role: StoryboardFrameRole) => void
}>()

const roleLabel = computed(() => storyboardFrameRoleLabel(props.role))

function slotKey (shot: CreativeShot, role: StoryboardFrameRole): string {
  return storyboardFrameSlotKey(shot.id, role)
}
</script>
