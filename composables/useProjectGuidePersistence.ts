import {
  loadGuideMessages,
  saveGuideMessages,
  type GuideChatMessage
} from '~/lib/project-guide'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'

const PB_ID = /^[a-z0-9]{15}$/
const SYNC_DEBOUNCE_MS = 800

/**
 * Cloud-persisted Project Guide chat with localStorage migration fallback.
 */
export function useProjectGuidePersistence (projectId: Ref<string>) {
  const { getAuthToken, isAuthenticated } = useAuth()

  const messages = ref<GuideChatMessage[]>([])
  const loading = ref(false)
  const syncing = ref(false)
  const cloudReady = ref(false)

  const canSync = computed(
    () =>
      isAuthenticated.value &&
      PB_ID.test(projectId.value) &&
      !!getAuthToken()
  )

  let syncTimer: ReturnType<typeof setTimeout> | null = null
  let loadGeneration = 0

  async function loadMessages (): Promise<void> {
    const id = projectId.value
    if (!id) {
      messages.value = []
      cloudReady.value = false
      return
    }

    const gen = ++loadGeneration
    loading.value = true

    if (canSync.value) {
      const token = getAuthToken()
      if (token) {
        try {
          const res = await $fetch<{ messages: GuideChatMessage[] }>(
            `/api/projects/${id}/guide/messages`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (gen !== loadGeneration) return
          const cloud = res.messages || []
          const local = loadGuideMessages(id)
          if (cloud.length === 0 && local.length > 0) {
            messages.value = local
            cloudReady.value = true
            await flushSync()
            return
          }
          messages.value = cloud
          saveGuideMessages(id, cloud)
          cloudReady.value = true
          return
        } catch {
          if (gen !== loadGeneration) return
          messages.value = loadGuideMessages(id)
          cloudReady.value = false
          return
        } finally {
          if (gen === loadGeneration) loading.value = false
        }
      }
    }

    if (gen !== loadGeneration) return
    messages.value = loadGuideMessages(id)
    cloudReady.value = false
    loading.value = false
  }

  async function flushSync (): Promise<void> {
    const id = projectId.value
    if (!id || !canSync.value) {
      saveGuideMessages(id, messages.value)
      return
    }
    const token = getAuthToken()
    if (!token) {
      saveGuideMessages(id, messages.value)
      return
    }

    syncing.value = true
    try {
      const res = await $fetch<{ messages: GuideChatMessage[] }>(
        `/api/projects/${id}/guide/messages`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: { messages: messages.value }
        }
      )
      messages.value = res.messages || messages.value
      saveGuideMessages(id, messages.value)
      cloudReady.value = true
    } catch (e: unknown) {
      saveGuideMessages(id, messages.value)
      throw e
    } finally {
      syncing.value = false
    }
  }

  function scheduleSync (): void {
    const id = projectId.value
    saveGuideMessages(id, messages.value)
    if (!canSync.value) return
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncTimer = null
      void flushSync().catch(() => {
        /* local copy retained */
      })
    }, SYNC_DEBOUNCE_MS)
  }

  function setMessages (next: GuideChatMessage[]): void {
    messages.value = next
    scheduleSync()
  }

  function patchMessages (fn: (current: GuideChatMessage[]) => GuideChatMessage[]): void {
    setMessages(fn(messages.value))
  }

  function appendMessage (message: GuideChatMessage): void {
    messages.value = [...messages.value, message]
    scheduleSync()
  }

  function clearMessages (): void {
    messages.value = []
    scheduleSync()
  }

  async function logDecision (input: {
    sourceType: string
    sourceId?: string
    targetType: 'project' | 'director' | 'character'
    targetId: string
    field: string
    oldValue?: string
    newValue: string
    rationale?: string
  }): Promise<void> {
    const id = projectId.value
    if (!canSync.value) return
    const token = getAuthToken()
    if (!token) return
    try {
      await $fetch(`/api/projects/${id}/guide/decisions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { decision: { ...input, status: 'applied' } }
      })
    } catch (e: unknown) {
      console.warn('Decision log write failed:', formatApiFetchError(e, 'Could not log decision'))
    }
  }

  watch(projectId, () => {
    void loadMessages()
  }, { immediate: true })

  watch(isAuthenticated, () => {
    void loadMessages()
  })

  onBeforeUnmount(() => {
    if (syncTimer) clearTimeout(syncTimer)
  })

  return {
    messages,
    loading,
    syncing,
    cloudReady,
    loadMessages,
    flushSync,
    setMessages,
    patchMessages,
    appendMessage,
    clearMessages,
    logDecision
  }
}
