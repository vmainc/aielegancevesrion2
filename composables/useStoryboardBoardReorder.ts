import type { Ref } from 'vue'
import type { CreativeShot } from '~/types/creative-shot'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'

type ToastApi = {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function useStoryboardBoardReorder (options: {
  projectId: Ref<string | undefined>
  sceneId: Ref<string>
  shots: Ref<CreativeShot[]>
  getAuthToken: () => string | null
  toast: ToastApi
}) {
  const draggingShotId = ref<string | null>(null)
  const dropTargetIndex = ref<number | null>(null)
  const reordering = ref(false)
  /** The board whose grip is pressed — only this card is `draggable` so inputs stay usable. */
  const armedShotId = ref<string | null>(null)

  function armBoardDrag (shotId: string) {
    armedShotId.value = shotId
  }

  function disarmBoardDrag () {
    armedShotId.value = null
  }

  function reorderLocally (fromIndex: number, toIndex: number): CreativeShot[] | null {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return null
    const list = [...options.shots.value]
    if (fromIndex >= list.length || toIndex > list.length) return null
    const [moved] = list.splice(fromIndex, 1)
    if (!moved) return null
    list.splice(toIndex, 0, moved)
    return list.map((shot, index) => ({ ...shot, sortOrder: index + 1 }))
  }

  async function persistShotOrder (ordered: CreativeShot[]): Promise<boolean> {
    const id = options.projectId.value
    const sid = options.sceneId.value
    const token = options.getAuthToken()
    if (!id || !sid || !token) return false

    reordering.value = true
    try {
      await $fetch(`/api/projects/${id}/scenes/${sid}/shots/reorder`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: { orderedShotIds: ordered.map(s => s.id) }
      })
      return true
    } catch (e: unknown) {
      options.toast.showToast(formatApiFetchError(e, 'Could not save board order'), 'error')
      return false
    } finally {
      reordering.value = false
    }
  }

  async function applyReorder (fromIndex: number, toIndex: number): Promise<boolean> {
    const previous = options.shots.value
    const next = reorderLocally(fromIndex, toIndex)
    if (!next) return false
    options.shots.value = next
    const ok = await persistShotOrder(next)
    if (!ok) {
      options.shots.value = previous
      return false
    }
    return true
  }

  function onBoardDragStart (shotId: string, ev: DragEvent) {
    draggingShotId.value = shotId
    dropTargetIndex.value = null
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer.setData('text/plain', shotId)
    }
  }

  function onBoardDragEnd () {
    draggingShotId.value = null
    dropTargetIndex.value = null
    armedShotId.value = null
  }

  function onDropSlotDragOver (index: number, ev: DragEvent) {
    if (!draggingShotId.value) return
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    dropTargetIndex.value = index
  }

  function onDropSlotDragLeave (index: number) {
    if (dropTargetIndex.value === index) {
      dropTargetIndex.value = null
    }
  }

  async function onDropAtSlot (toIndex: number, ev: DragEvent) {
    ev.preventDefault()
    const shotId = draggingShotId.value || ev.dataTransfer?.getData('text/plain') || ''
    draggingShotId.value = null
    dropTargetIndex.value = null
    if (!shotId) return

    const fromIndex = options.shots.value.findIndex(s => s.id === shotId)
    if (fromIndex < 0) return

    const clamped = Math.max(0, Math.min(toIndex, options.shots.value.length))
    let targetIndex = clamped
    if (fromIndex < clamped) targetIndex = clamped - 1
    if (fromIndex === targetIndex) return

    await applyReorder(fromIndex, targetIndex)
  }

  return {
    draggingShotId,
    dropTargetIndex,
    reordering,
    armedShotId,
    armBoardDrag,
    disarmBoardDrag,
    onBoardDragStart,
    onBoardDragEnd,
    onDropSlotDragOver,
    onDropSlotDragLeave,
    onDropAtSlot,
    applyReorder,
    persistShotOrder
  }
}
