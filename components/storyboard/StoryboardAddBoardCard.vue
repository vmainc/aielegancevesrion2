<template>
  <li
    class="rounded-xl border-2 border-dashed bg-gray-50/80 overflow-hidden flex flex-col min-h-[12rem] transition-colors"
    :class="[
      draggingShotId && dropTargetIndex === shotsLength
        ? 'border-primary bg-primary/10'
        : 'border-gray-300 hover:border-primary/50 hover:bg-primary/5',
      reordering || addingBoard ? 'pointer-events-none opacity-60' : 'cursor-pointer'
    ]"
    @dragover="onDropSlotDragOver(shotsLength, $event)"
    @dragleave="onDropSlotDragLeave(shotsLength)"
    @drop="onDropAtSlot(shotsLength, $event)"
    @click="onAddBoardCardClick"
  >
    <div class="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
      <span class="text-2xl text-gray-400 leading-none">+</span>
      <p class="text-sm font-semibold text-gray-700">
        {{ addingBoard ? 'Adding board…' : 'Add board' }}
      </p>
      <p class="text-xs text-gray-500 max-w-[14rem]">
        Click to add a board, or drag a board here to move it to the end.
      </p>
    </div>
  </li>
</template>

<script setup lang="ts">
defineProps<{
  shotsLength: number
  draggingShotId: string | null
  dropTargetIndex: number | null
  reordering: boolean
  addingBoard: boolean
  onDropSlotDragOver: (index: number, event: DragEvent) => void
  onDropSlotDragLeave: (index: number) => void
  onDropAtSlot: (index: number, event: DragEvent) => void
  onAddBoardCardClick: () => void
}>()
</script>
