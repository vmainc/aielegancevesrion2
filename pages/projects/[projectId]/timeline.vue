<template>
  <div class="max-w-[1600px]">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <p class="text-sm text-gray-500 mb-1">
          <span class="text-primary font-medium">{{ stepBadge || 'Timeline' }}</span>
          · AI film assembly
        </p>
        <h1 class="text-lg font-semibold text-gray-900">
          Timeline editor
        </h1>
        <p class="text-sm text-gray-600 mt-1 max-w-2xl">
          Arrange and trim clips on a two-track timeline. Add clips from
          <NuxtLink :to="`/projects/${projectId}/video`" class="text-primary font-medium hover:underline">Video</NuxtLink>.
          Removing a clip only edits the timeline — files stay in Assets.
        </p>
      </div>
      <NuxtLink
        :to="`/projects/${projectId}/video`"
        class="text-sm font-medium text-primary hover:underline shrink-0"
      >
        ← Back to Video
      </NuxtLink>
    </div>

    <CloudProjectRequired
      feature-label="The timeline editor"
      loading-label="Loading timeline"
      loading-sub-label="Preparing project workspace…"
    >
      <div class="space-y-4">
        <!-- Persistence status -->
        <div
          v-if="editorReady"
          class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm"
          role="status"
        >
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span v-if="persistence.status.loading" class="text-gray-500">Loading cloud timeline…</span>
            <template v-else>
              <span
                class="inline-flex items-center gap-1.5 font-medium"
                :class="timelineSyncStatusClass(persistence.status.syncStatus)"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="timelineSyncStatusDotClass(persistence.status.syncStatus)"
                />
                {{ TIMELINE_SYNC_STATUS_LABELS[persistence.status.syncStatus] }}
              </span>
              <span v-if="persistence.status.localBackupDetected" class="text-gray-600 text-xs">
                Local backup ({{ persistence.status.localClipCount }} clips)
              </span>
              <span v-if="persistence.status.cloudClipCount > 0 || clipSummary.count > 0" class="text-gray-600 text-xs">
                {{ persistence.status.cloudClipCount || clipSummary.count }} clips · {{ formatDuration(persistence.status.durationSeconds || clipSummary.duration) }}
              </span>
              <span v-if="persistence.status.lastSavedAt && persistence.status.syncStatus === 'synced'" class="text-gray-500 text-xs">
                Last cloud save {{ formatSavedAt(persistence.status.lastSavedAt) }}
              </span>
              <span v-if="persistence.status.savePending || persistence.status.flushPending" class="text-primary text-xs font-medium">
                {{ persistence.status.flushPending ? 'Syncing queued save…' : 'Saving…' }}
              </span>
            </template>
            <button
              v-if="persistence.status.queueActive && !persistence.status.conflictActive"
              type="button"
              class="text-xs font-medium text-sky-700 hover:underline disabled:opacity-50"
              :disabled="persistence.status.flushPending || persistence.status.loading"
              @click="onRetryCloudSync"
            >
              Retry cloud sync
            </button>
            <button
              v-if="persistence.status.queueActive && !persistence.status.conflictActive"
              type="button"
              class="text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
              :disabled="persistence.status.flushPending"
              @click="onClearQueuedSave"
            >
              Clear queued save
            </button>
            <button
              v-if="persistence.status.cloudLoaded && !persistence.status.savePending && !persistence.status.conflictActive && (persistence.status.syncStatus === 'synced' || persistence.status.syncStatus === 'local_pending')"
              type="button"
              class="ml-auto text-xs font-medium text-primary hover:underline disabled:opacity-50"
              :disabled="persistence.status.loading"
              @click="onSaveNow"
            >
              Save to cloud now
            </button>
          </div>
          <p
            v-if="persistence.status.queueActive && !persistence.status.conflictActive"
            class="mt-2 text-xs text-sky-800"
          >
            Queued for cloud sync
            <span v-if="persistence.status.queuedSaveCount > 0">
              ({{ persistence.status.queuedSaveCount }} pending)
            </span>
            <span v-if="persistence.status.queueAttemptCount > 0">
              · {{ persistence.status.queueAttemptCount }} attempt{{ persistence.status.queueAttemptCount === 1 ? '' : 's' }}
            </span>
          </p>
          <p
            v-if="persistence.status.queueLastError && persistence.status.queueActive && !persistence.status.conflictActive"
            class="mt-1 text-xs text-sky-900/80"
          >
            Last error: {{ persistence.status.queueLastError }}
          </p>
          <p
            v-if="persistence.status.saveError && !persistence.status.conflictActive && !persistence.status.queueActive"
            class="mt-2 text-xs text-red-600"
          >
            {{ persistence.status.saveError }}
          </p>
          <p
            v-if="persistence.status.syncStatus === 'local_pending' && !persistence.status.conflictActive && !persistence.status.queueActive"
            class="mt-2 text-xs text-amber-700"
          >
            Local changes not synced to cloud. Use Save to cloud now or resolve any conflict.
          </p>
        </div>

        <!-- Cloud save conflict (409) -->
        <div
          v-if="editorReady && persistence.status.conflictActive"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="alert"
        >
          <p class="font-medium">Cloud timeline changed while you were editing</p>
          <p class="mt-1 text-red-900/90">
            Another save or device updated the cloud timeline (revision {{ persistence.status.revision }}).
            Your local edits are still in this browser. Choose how to continue.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              :disabled="conflictBusy"
              @click="onReloadCloud"
            >
              {{ conflictBusy ? 'Loading…' : 'Reload cloud timeline' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
              :disabled="conflictBusy"
              @click="onKeepLocal"
            >
              Keep my local version
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-medium text-red-950 hover:bg-red-100 disabled:opacity-50"
              :disabled="conflictBusy"
              @click="onOverwriteCloud"
            >
              Save my version over cloud
            </button>
          </div>
        </div>

        <!-- Import local → cloud -->
        <div
          v-if="editorReady && persistence.status.showImportPrompt"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p class="font-medium">Local timeline found in this browser</p>
          <p class="mt-1 text-amber-900/90">
            Save it to the cloud so it is backed up and available on other devices.
            Your local copy is kept as a backup.
          </p>
          <p v-if="localPreview" class="mt-2 text-xs text-amber-800">
            Preview: {{ localPreview.clipCount }} clips
            ({{ localPreview.videoCount }} video, {{ localPreview.audioCount }} audio)
            · ~{{ formatDuration(localPreview.durationSeconds) }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              :disabled="importing"
              @click="onImportLocal"
            >
              {{ importing ? 'Saving…' : 'Save local timeline to cloud' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              @click="persistence.dismissImportPrompt()"
            >
              Keep editing locally
            </button>
          </div>
        </div>

        <!-- Cloud + local conflict -->
        <div
          v-if="editorReady && persistence.status.showCloudLocalConflict && !persistence.status.showImportPrompt"
          class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
        >
          <p class="font-medium">Cloud timeline and local backup both exist</p>
          <p class="mt-1 text-sky-900/90">
            The editor loaded the cloud version. This browser also has a local backup
            ({{ persistence.status.localClipCount }} clips).
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
              :disabled="importing"
              @click="onReplaceWithLocal"
            >
              Replace cloud with local backup
            </button>
          </div>
        </div>

        <div
          class="rounded-2xl border border-gray-800 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 p-4 sm:p-6 shadow-xl"
        >
          <div v-if="!editorReady" class="py-16 text-center text-sm text-zinc-400">
            Loading timeline…
          </div>
          <EditorTimelineEditor
            v-else-if="projectId"
            :key="editorReloadKey"
            :project-id="projectId"
            :initial-document="initialEditorDocument"
            :persistence-status="persistence.status"
            @persist="onEditorPersist"
            @document-stats="onDocumentStats"
          />
        </div>

        <ProjectVideoSceneAccordion
          v-if="projectId && editorReady"
          :project-id="projectId"
        />
      </div>
    </CloudProjectRequired>
  </div>
</template>

<script setup lang="ts">
import { loadTimelineFromStorage } from '~/lib/timeline-editor/storage'
import { useTimelineClipPushedState } from '~/lib/append-project-timeline-video'
import {
  editorDocumentToProjectTimelineDocument,
  timelineDocumentStats
} from '~/lib/project-timeline-normalize'
import type { TimelineEditorDocument } from '~/types/timeline-editor'
import {
  TIMELINE_SYNC_STATUS_LABELS,
  timelineSyncStatusClass,
  timelineSyncStatusDotClass
} from '~/lib/timeline-sync-status'

const { activeProjectId } = useCreativeProject()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const projectId = activeProjectId
const projectIdRef = computed(() => projectId.value || '')

const persistence = useProjectTimeline(projectIdRef)
const editorReady = ref(false)
const editorReloadKey = ref(0)
const initialEditorDocument = ref<TimelineEditorDocument | null | undefined>(undefined)
const importing = ref(false)
const conflictBusy = ref(false)
const syncBusy = ref(false)
const latestEditorDoc = ref<TimelineEditorDocument | null>(null)

const clipSummary = ref({ count: 0, duration: 0 })

const localPreview = computed(() => {
  if (!projectId.value || !import.meta.client) return null
  const local = loadTimelineFromStorage(projectId.value)
  if (!local?.clips.length) return null
  return timelineDocumentStats(editorDocumentToProjectTimelineDocument(local))
})

function formatDuration (seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

function formatSavedAt (iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function onEditorPersist (doc: TimelineEditorDocument) {
  latestEditorDoc.value = doc
  if (!persistence.status.conflictActive && !persistence.status.localChangesPending) {
    persistence.scheduleCloudSave(doc)
  }
}

function onDocumentStats (stats: { count: number; duration: number }) {
  clipSummary.value = stats
}

async function onImportLocal () {
  importing.value = true
  try {
    const ok = await persistence.importLocalToCloud()
    if (ok) {
      const cloud = persistence.cloudTimeline.value
      if (cloud?.document) {
        initialEditorDocument.value = {
          version: 2,
          clips: cloud.document.clips,
          zoom: cloud.document.zoom
        }
        editorReloadKey.value++
      }
      toast.showToast('Local timeline saved to cloud. Local backup kept.', 'success')
    } else {
      toast.showToast(persistence.status.saveError || 'Import failed', 'error')
    }
  } finally {
    importing.value = false
  }
}

async function onReplaceWithLocal () {
  if (!confirm('Replace the cloud timeline with the local backup in this browser? Assets are not deleted.')) {
    return
  }
  importing.value = true
  try {
    const ok = await persistence.replaceCloudWithLocal()
    if (ok) {
      const local = loadTimelineFromStorage(projectId.value || '')
      if (local) {
        initialEditorDocument.value = local
        editorReloadKey.value++
      }
      toast.showToast('Cloud timeline replaced with local backup.', 'success')
    } else {
      toast.showToast(persistence.status.saveError || 'Replace failed', 'error')
    }
  } finally {
    importing.value = false
  }
}

async function onSaveNow () {
  const doc = latestEditorDoc.value || loadTimelineFromStorage(projectId.value || '')
  if (!doc) {
    toast.showToast('Nothing to save yet.', 'info')
    return
  }
  const saved = await persistence.saveCloud(doc, {
    forceRevision: persistence.status.revision || undefined
  })
  if (saved) toast.showToast('Timeline saved to cloud.', 'success')
  else if (persistence.status.queueActive) {
    toast.showToast('Save queued for cloud sync.', 'info')
  } else if (!persistence.status.conflictActive) {
    toast.showToast(persistence.status.saveError || 'Save failed', 'error')
  }
}

async function onReloadCloud () {
  conflictBusy.value = true
  try {
    const doc = await persistence.reloadCloudIntoEditor()
    if (doc) {
      initialEditorDocument.value = doc
      editorReloadKey.value++
      toast.showToast('Loaded cloud timeline. Your previous local edits remain in browser backup.', 'success')
    } else {
      toast.showToast('Could not load cloud timeline.', 'error')
    }
  } finally {
    conflictBusy.value = false
  }
}

function onKeepLocal () {
  persistence.keepLocalAfterConflict()
  toast.showToast('Keeping your local version. Changes not synced to cloud.', 'info')
}

async function onOverwriteCloud () {
  const doc = latestEditorDoc.value || loadTimelineFromStorage(projectId.value || '')
  if (!doc) {
    toast.showToast('Nothing to save.', 'info')
    return
  }
  if (!confirm(
    'Save your current timeline over the cloud version? This replaces the cloud timeline for this project. Assets are not deleted.'
  )) {
    return
  }
  conflictBusy.value = true
  try {
    const ok = await persistence.overwriteCloudWithDocument(doc)
    if (ok) toast.showToast('Cloud timeline updated with your version.', 'success')
    else if (!persistence.status.conflictActive) {
      toast.showToast(persistence.status.saveError || 'Overwrite failed', 'error')
    }
  } finally {
    conflictBusy.value = false
  }
}

async function onRetryCloudSync () {
  syncBusy.value = true
  try {
    const ok = await persistence.retryCloudSync()
    if (ok) toast.showToast('Queued timeline synced to cloud.', 'success')
    else if (persistence.status.conflictActive) {
      toast.showToast('Cloud conflict — resolve before syncing.', 'info')
    } else if (persistence.status.queueActive) {
      toast.showToast(persistence.status.queueLastError || 'Sync failed — still queued.', 'error')
    } else {
      toast.showToast('Nothing queued to sync.', 'info')
    }
  } finally {
    syncBusy.value = false
  }
}

function onClearQueuedSave () {
  if (!confirm('Clear the queued cloud save? Your local timeline backup in this browser is kept.')) {
    return
  }
  persistence.clearQueuedCloudSave()
  toast.showToast('Queued cloud save cleared. Local backup unchanged.', 'info')
}

onMounted(async () => {
  if (!projectId.value) return
  await persistence.fetchCloud()
  const { document } = persistence.resolveInitialDocument()
  initialEditorDocument.value = document
  editorReady.value = true
  if (persistence.status.queueActive) {
    void persistence.flushCloudSaveQueue()
  }
})

watch(projectId, async (pid) => {
  if (!pid) return
  editorReady.value = false
  initialEditorDocument.value = undefined
  await persistence.fetchCloud()
  const { document } = persistence.resolveInitialDocument()
  initialEditorDocument.value = document
  editorReady.value = true
})

const timelineClipPushed = useTimelineClipPushedState()

watch(timelineClipPushed, async (ev) => {
  if (!ev || ev.projectId !== projectId.value) return
  persistence.cancelPendingCloudSave()
  await persistence.fetchCloud()
  timelineClipPushed.value = null
})
</script>
