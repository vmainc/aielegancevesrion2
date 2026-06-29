import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  editorDocumentToProjectTimelineDocument,
  projectTimelineDocumentToEditorDocument,
  timelineDocumentStats
} from '~/lib/project-timeline-normalize'
import { loadTimelineFromStorage } from '~/lib/timeline-editor/storage'
import {
  defaultLocalBackupKey,
  snapshotTimelineLocalBackup,
  writeTimelineLocalImportMarker
} from '~/lib/timeline-editor/local-backup'
import {
  clearTimelineCloudSaveQueue,
  countTimelineCloudSaveQueue,
  enqueueTimelineCloudSave,
  markTimelineCloudSaveQueueAttempt,
  readTimelineCloudSaveQueue
} from '~/lib/timeline-editor/cloud-save-queue'
import {
  isBrowserOffline,
  isTimelineCloudSaveQueueableError,
  timelineCloudSaveQueueErrorMessage
} from '~/lib/timeline-cloud-save-error'
import type { TimelineSyncStatus } from '~/lib/timeline-sync-status'
import type {
  ProjectTimeline,
  ProjectTimelineGetResponse,
  ProjectTimelinePutResponse
} from '~/types/project-timeline'
import type { TimelineEditorDocument } from '~/types/timeline-editor'

export type TimelinePersistenceSource = 'cloud' | 'local' | 'empty'

export type TimelinePersistenceStatus = {
  loading: boolean
  cloudLoaded: boolean
  localBackupDetected: boolean
  localClipCount: number
  cloudClipCount: number
  durationSeconds: number
  lastSavedAt: string | null
  saveError: string | null
  savePending: boolean
  loadedSource: TimelinePersistenceSource
  revision: number
  timelineId: string | null
  showImportPrompt: boolean
  showCloudLocalConflict: boolean
  conflictActive: boolean
  localChangesPending: boolean
  syncStatus: TimelineSyncStatus
  queueActive: boolean
  queuedSaveCount: number
  queueLastError: string | null
  queueAttemptCount: number
  flushPending: boolean
}

function computeSyncStatus (status: TimelinePersistenceStatus): TimelineSyncStatus {
  if (status.conflictActive) return 'conflict'
  if (status.queueActive) return 'queued'
  if (!status.cloudLoaded) return 'local_only'
  if (status.localChangesPending) return 'local_pending'
  return 'synced'
}

export function useProjectTimeline (projectId: Ref<string>) {
  const { getAuthToken } = useAuth()

  const status = reactive<TimelinePersistenceStatus>({
    loading: false,
    cloudLoaded: false,
    localBackupDetected: false,
    localClipCount: 0,
    cloudClipCount: 0,
    durationSeconds: 0,
    lastSavedAt: null,
    saveError: null,
    savePending: false,
    loadedSource: 'empty',
    revision: 0,
    timelineId: null,
    showImportPrompt: false,
    showCloudLocalConflict: false,
    conflictActive: false,
    localChangesPending: false,
    syncStatus: 'local_only',
    queueActive: false,
    queuedSaveCount: 0,
    queueLastError: null,
    queueAttemptCount: 0,
    flushPending: false
  })

  let cloudTimeline = ref<ProjectTimeline | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingDoc: TimelineEditorDocument | null = null
  let flushInFlight = false

  function refreshSyncStatus () {
    status.syncStatus = computeSyncStatus(status)
  }

  function refreshQueueStatus () {
    if (!import.meta.client || !projectId.value) {
      status.queueActive = false
      status.queuedSaveCount = 0
      status.queueLastError = null
      status.queueAttemptCount = 0
      refreshSyncStatus()
      return
    }
    const entry = readTimelineCloudSaveQueue(projectId.value)
    status.queueActive = Boolean(entry)
    status.queuedSaveCount = countTimelineCloudSaveQueue(projectId.value)
    status.queueLastError = entry?.lastError ?? null
    status.queueAttemptCount = entry?.attemptCount ?? 0
    refreshSyncStatus()
  }

  function headers () {
    return pocketBaseBearerHeaders(getAuthToken())
  }

  function apiBase () {
    return `/api/projects/${projectId.value}/timeline`
  }

  function readLocalDocument (): TimelineEditorDocument | null {
    if (!import.meta.client || !projectId.value) return null
    return loadTimelineFromStorage(projectId.value)
  }

  function refreshLocalDetection () {
    const local = readLocalDocument()
    status.localBackupDetected = Boolean(local?.clips.length)
    status.localClipCount = local?.clips.length ?? 0
    refreshSyncStatus()
  }

  function cancelPendingCloudSave () {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    pendingDoc = null
    status.savePending = false
  }

  function clearConflict () {
    status.conflictActive = false
    status.saveError = null
    refreshSyncStatus()
  }

  function setConflict () {
    status.conflictActive = true
    status.saveError = null
    cancelPendingCloudSave()
    refreshSyncStatus()
  }

  function queueCloudSave (
    doc: TimelineEditorDocument,
    opts?: { baseRevision?: number | null; lastError?: string; importedFromLocal?: boolean }
  ) {
    if (!projectId.value) return
    const needsRevision = status.cloudLoaded || status.revision > 0 || Boolean(status.timelineId)
    enqueueTimelineCloudSave(projectId.value, doc, {
      baseRevision: opts?.baseRevision ?? (needsRevision ? status.revision : null),
      lastError: opts?.lastError ?? null,
      importedFromLocal: opts?.importedFromLocal
    })
    refreshQueueStatus()
  }

  function applyCloudTimeline (timeline: ProjectTimeline | null) {
    cloudTimeline.value = timeline
    status.cloudLoaded = Boolean(timeline)
    status.revision = timeline?.revision ?? 0
    status.timelineId = timeline?.id ?? null
    status.cloudClipCount = timeline?.clipCount ?? 0
    status.lastSavedAt = timeline?.updated ?? null
    if (timeline) status.loadedSource = 'cloud'
    refreshLocalDetection()
  }

  async function fetchCloud (): Promise<ProjectTimeline | null> {
    if (!projectId.value) return null
    status.loading = true
    if (!status.conflictActive) status.saveError = null
    try {
      const res = await $fetch<ProjectTimelineGetResponse>(apiBase(), {
        headers: headers()
      })
      applyCloudTimeline(res.timeline)
      status.showImportPrompt = !res.timeline && status.localBackupDetected
      status.showCloudLocalConflict = Boolean(res.timeline && status.localBackupDetected)
      return res.timeline
    } catch (e: unknown) {
      if (!status.conflictActive) {
        status.saveError = formatApiFetchError(e, 'Could not load cloud timeline')
      }
      refreshLocalDetection()
      return null
    } finally {
      status.loading = false
    }
  }

  function resolveInitialDocument (): {
    source: TimelinePersistenceSource
    document: TimelineEditorDocument | null
  } {
    refreshLocalDetection()
    refreshQueueStatus()
    const cloud = cloudTimeline.value
    if (cloud?.document) {
      status.loadedSource = 'cloud'
      const doc = projectTimelineDocumentToEditorDocument(cloud.document)
      const stats = timelineDocumentStats(cloud.document)
      status.durationSeconds = stats.durationSeconds
      status.cloudClipCount = stats.clipCount
      if (!status.queueActive) status.localChangesPending = false
      refreshSyncStatus()
      return { source: 'cloud', document: doc }
    }
    const local = readLocalDocument()
    if (local?.clips.length) {
      status.loadedSource = 'local'
      status.showImportPrompt = true
      if (!status.queueActive) status.localChangesPending = true
      const stats = timelineDocumentStats(
        editorDocumentToProjectTimelineDocument(local)
      )
      status.durationSeconds = stats.durationSeconds
      refreshSyncStatus()
      return { source: 'local', document: local }
    }
    status.loadedSource = 'empty'
    status.durationSeconds = 0
    refreshSyncStatus()
    return { source: 'empty', document: null }
  }

  async function saveCloud (
    doc: TimelineEditorDocument,
    opts?: { importedFromLocal?: boolean; forceRevision?: number; overwrite?: boolean; fromQueue?: boolean }
  ): Promise<ProjectTimeline | null> {
    if (!projectId.value) return null

    if (!opts?.fromQueue && isBrowserOffline()) {
      queueCloudSave(doc, {
        lastError: 'Offline — save queued for when connection returns.',
        importedFromLocal: opts?.importedFromLocal
      })
      status.saveError = null
      return null
    }

    status.savePending = true
    if (!status.conflictActive) status.saveError = null
    try {
      const needsRevision = status.cloudLoaded || status.revision > 0 || Boolean(status.timelineId)
      const baseRevision = needsRevision
        ? (opts?.forceRevision ?? status.revision)
        : undefined
      const body = {
        baseRevision,
        document: editorDocumentToProjectTimelineDocument(doc),
        importedFromLocal: Boolean(opts?.importedFromLocal),
        source: opts?.importedFromLocal ? 'local_import' as const : 'editor' as const
      }
      const res = await $fetch<ProjectTimelinePutResponse>(apiBase(), {
        method: 'PUT',
        headers: headers(),
        body
      })
      applyCloudTimeline(res.timeline)
      status.showImportPrompt = false
      status.showCloudLocalConflict = status.localBackupDetected
      clearConflict()
      status.localChangesPending = false
      clearTimelineCloudSaveQueue(projectId.value)
      refreshQueueStatus()
      refreshSyncStatus()
      return res.timeline
    } catch (e: unknown) {
      const err = e as {
        statusCode?: number
        data?: { timeline?: ProjectTimeline; currentRevision?: number }
      }
      if (err?.statusCode === 409) {
        if (err.data?.timeline) {
          applyCloudTimeline(err.data.timeline)
        } else {
          await fetchCloud()
        }
        if (opts?.fromQueue) {
          markTimelineCloudSaveQueueAttempt(projectId.value, {
            status: 'failed',
            lastError: 'Cloud timeline changed — resolve conflict to continue.'
          })
          refreshQueueStatus()
        }
        setConflict()
        return null
      }
      if (isTimelineCloudSaveQueueableError(e)) {
        const msg = timelineCloudSaveQueueErrorMessage(e, 'Cloud save unavailable')
        queueCloudSave(doc, {
          baseRevision: opts?.forceRevision ?? status.revision,
          lastError: msg,
          importedFromLocal: opts?.importedFromLocal
        })
        if (opts?.fromQueue) {
          markTimelineCloudSaveQueueAttempt(projectId.value, {
            status: 'failed',
            lastError: msg
          })
          refreshQueueStatus()
        }
        status.saveError = null
        refreshSyncStatus()
        return null
      }
      if (opts?.fromQueue) {
        markTimelineCloudSaveQueueAttempt(projectId.value, {
          status: 'failed',
          lastError: formatApiFetchError(e, 'Could not save timeline to cloud')
        })
        refreshQueueStatus()
      }
      status.saveError = formatApiFetchError(e, 'Could not save timeline to cloud')
      refreshSyncStatus()
      return null
    } finally {
      status.savePending = false
    }
  }

  function scheduleCloudSave (doc: TimelineEditorDocument) {
    if (!import.meta.client || !projectId.value) return
    if (status.conflictActive || status.localChangesPending) return

    if (isBrowserOffline()) {
      queueCloudSave(doc, { lastError: 'Offline — save queued for when connection returns.' })
      return
    }

    pendingDoc = doc
    if (saveTimer) clearTimeout(saveTimer)
    status.savePending = true
    saveTimer = setTimeout(async () => {
      const toSave = pendingDoc
      pendingDoc = null
      saveTimer = null
      if (!toSave) {
        status.savePending = false
        return
      }
      const stats = timelineDocumentStats(editorDocumentToProjectTimelineDocument(toSave))
      status.durationSeconds = stats.durationSeconds
      status.cloudClipCount = stats.clipCount
      await saveCloud(toSave)
    }, 1500)
  }

  async function flushCloudSaveQueue (): Promise<boolean> {
    if (!import.meta.client || !projectId.value || flushInFlight) return false
    if (status.conflictActive || isBrowserOffline()) return false

    const entry = readTimelineCloudSaveQueue(projectId.value)
    if (!entry) {
      refreshQueueStatus()
      return false
    }

    flushInFlight = true
    status.flushPending = true
    markTimelineCloudSaveQueueAttempt(projectId.value, { status: 'flushing' })
    refreshQueueStatus()

    const doc = projectTimelineDocumentToEditorDocument(entry.document)
    const saved = await saveCloud(doc, {
      forceRevision: entry.baseRevision ?? (status.revision || undefined),
      importedFromLocal: entry.importedFromLocal,
      fromQueue: true
    })

    flushInFlight = false
    status.flushPending = false
    refreshQueueStatus()
    return Boolean(saved)
  }

  function clearQueuedCloudSave () {
    if (!projectId.value) return
    clearTimelineCloudSaveQueue(projectId.value)
    refreshQueueStatus()
  }

  async function retryCloudSync (): Promise<boolean> {
    if (!projectId.value) return false
    const entry = readTimelineCloudSaveQueue(projectId.value)
    const doc = entry
      ? projectTimelineDocumentToEditorDocument(entry.document)
      : (readLocalDocument() ?? null)
    if (!doc) return false
    if (!entry) {
      queueCloudSave(doc, { baseRevision: status.revision })
    }
    return flushCloudSaveQueue()
  }

  function onBrowserOnline () {
    if (!projectId.value || !status.queueActive) return
    void flushCloudSaveQueue()
  }

  if (import.meta.client) {
    onMounted(() => {
      refreshQueueStatus()
      window.addEventListener('online', onBrowserOnline)
    })
    onUnmounted(() => {
      window.removeEventListener('online', onBrowserOnline)
    })
    watch(projectId, () => {
      refreshQueueStatus()
    })
  }

  async function importLocalToCloud (): Promise<boolean> {
    const local = readLocalDocument()
    if (!local?.clips.length) return false
    const saved = await saveCloud(local, { importedFromLocal: true })
    if (!saved) return false
    writeTimelineLocalImportMarker(projectId.value, {
      cloudTimelineId: saved.id,
      revision: saved.revision,
      importedAt: new Date().toISOString()
    })
    status.showImportPrompt = false
    status.localChangesPending = false
    refreshSyncStatus()
    return true
  }

  async function replaceCloudWithLocal (): Promise<boolean> {
    const local = readLocalDocument()
    if (!local?.clips.length) return false
    return Boolean(await saveCloud(local, { importedFromLocal: true, forceRevision: status.revision }))
  }

  async function reloadCloudIntoEditor (): Promise<TimelineEditorDocument | null> {
    if (!projectId.value) return null
    snapshotTimelineLocalBackup(projectId.value)
    cancelPendingCloudSave()
    const cloud = cloudTimeline.value ?? (await fetchCloud())
    clearConflict()
    status.localChangesPending = false
    if (!cloud?.document) return null
    refreshSyncStatus()
    return projectTimelineDocumentToEditorDocument(cloud.document)
  }

  function keepLocalAfterConflict () {
    cancelPendingCloudSave()
    clearConflict()
    status.localChangesPending = true
    refreshSyncStatus()
  }

  async function overwriteCloudWithDocument (
    doc: TimelineEditorDocument
  ): Promise<boolean> {
    if (!status.revision) await fetchCloud()
    const saved = await saveCloud(doc, { forceRevision: status.revision, overwrite: true })
    if (saved) {
      clearTimelineCloudSaveQueue(projectId.value)
      refreshQueueStatus()
    }
    return Boolean(saved)
  }

  function dismissImportPrompt () {
    status.showImportPrompt = false
    status.localChangesPending = true
    refreshSyncStatus()
  }

  return {
    status,
    cloudTimeline,
    fetchCloud,
    applyCloudTimeline,
    cancelPendingCloudSave,
    resolveInitialDocument,
    saveCloud,
    scheduleCloudSave,
    importLocalToCloud,
    replaceCloudWithLocal,
    reloadCloudIntoEditor,
    keepLocalAfterConflict,
    overwriteCloudWithDocument,
    dismissImportPrompt,
    refreshLocalDetection,
    refreshQueueStatus,
    flushCloudSaveQueue,
    retryCloudSync,
    clearQueuedCloudSave,
    defaultLocalBackupKey: () => defaultLocalBackupKey(projectId.value)
  }
}
