import { newGuideMessageId, type GuideChatMessage, type GuideSuggestion } from '~/lib/project-guide'
import { displayProjectSynopsis } from '~/lib/format-stored-concept'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { CreativeProject, ProjectDirector, CreativeCharacter } from '~/types/creative-project'
import type { CreativeSceneListItem } from '~/types/creative-scene'

const PB_ID = /^[a-z0-9]{15}$/

/**
 * Project Guide chat + suggestion apply — shared by the Guide tab and companion.
 */
export function useProjectGuideChat (projectId: Ref<string>) {
  const { activeProject, updateProject } = useCreativeProject()
  const { getAuthToken, isAuthenticated } = useAuth()
  const toast = useToast()

  const canUseGuide = computed(
    () => PB_ID.test(projectId.value) && isAuthenticated.value
  )

  const {
    messages,
    loading: guideLoading,
    appendMessage,
    clearMessages,
    logDecision,
    flushSync,
    patchMessages
  } = useProjectGuidePersistence(projectId)

  const draft = ref('')
  const sending = ref(false)
  const applyingSuggestionId = ref('')
  const appliedSuggestionIds = ref(new Set<string>())
  const castCount = ref(0)
  const panelCount = ref(0)

  const needsStory = computed(() => !displayProjectSynopsis(activeProject.value || {}).trim())

  const directorReady = computed(() => {
    const d = activeProject.value?.director
    if (!d) return false
    return Boolean(
      d.name?.trim() ||
        d.style?.trim() ||
        d.tone?.trim() ||
        d.camera_preferences?.trim()
    )
  })

  const statusBits = computed(() => {
    const bits: string[] = []
    if (!activeProject.value) return bits
    bits.push(needsStory.value ? 'No story yet' : 'Story')
    if (castCount.value > 0) bits.push(`${castCount.value} cast`)
    if (directorReady.value) bits.push('Director')
    if (panelCount.value > 0) bits.push(`${panelCount.value} panels`)
    return bits
  })

  const starters = computed(() => {
    if (needsStory.value) return [] as string[]
    const list = [
      'Summarize this story in three sentences.',
      'What’s missing before I can generate video?',
      'Who are the main characters, and what should stay consistent about them?',
      'What should I focus on next?'
    ]
    if (!directorReady.value) {
      list[1] = 'Help me set a clear visual tone for the director bible.'
    }
    return list
  })

  async function loadStatus () {
    castCount.value = 0
    panelCount.value = 0
    if (!canUseGuide.value) return
    const token = getAuthToken()
    const id = projectId.value
    if (!token || !id) return
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [charRes, sceneRes] = await Promise.all([
        $fetch<{ characters?: CreativeCharacter[] }>(`/api/projects/${id}/characters`, { headers }),
        $fetch<{ scenes?: CreativeSceneListItem[] }>(`/api/projects/${id}/scenes`, { headers })
      ])
      castCount.value = charRes.characters?.length ?? 0
      panelCount.value = (sceneRes.scenes ?? []).reduce((n, s) => n + (s.shotCount || 0), 0)
    } catch {
      /* status strip is optional */
    }
  }

  function sendStarter (text: string) {
    draft.value = text
    void sendMessage()
  }

  function readFieldValue (
    target: GuideSuggestion['target'],
    field: string,
    _characterId?: string
  ): string {
    const project = activeProject.value
    if (!project) return ''
    if (target === 'project') {
      const v = (project as Record<string, unknown>)[field]
      return typeof v === 'string' ? v : ''
    }
    if (target === 'director') {
      const director = project.director || {}
      const v = (director as Record<string, unknown>)[field]
      return typeof v === 'string' ? v : ''
    }
    return ''
  }

  async function sendMessage () {
    const text = draft.value.trim()
    if (!text || sending.value || !canUseGuide.value) return

    const token = getAuthToken()
    if (!token) return

    const userMsg: GuideChatMessage = {
      id: newGuideMessageId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }
    appendMessage(userMsg)
    draft.value = ''
    sending.value = true

    try {
      const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
      const res = await $fetch<{ reply: string; suggestions: GuideSuggestion[] }>(
        `/api/projects/${projectId.value}/guide`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { messages: history }
        }
      )
      appendMessage({
        id: newGuideMessageId(),
        role: 'assistant',
        content: res.reply || 'Done.',
        suggestions: res.suggestions || [],
        createdAt: new Date().toISOString()
      })
    } catch (e: unknown) {
      toast.showToast(formatApiFetchError(e, 'Could not reach Guide'), 'error')
      appendMessage({
        id: newGuideMessageId(),
        role: 'assistant',
        content: 'Sorry — I could not respond right now. Check your connection and try again.',
        createdAt: new Date().toISOString()
      })
    } finally {
      sending.value = false
    }
  }

  async function applySuggestion (s: GuideSuggestion) {
    const token = getAuthToken()
    const pid = projectId.value
    if (!token || !pid || appliedSuggestionIds.value.has(s.id)) return

    const oldValue = readFieldValue(s.target, s.field, s.characterId)

    applyingSuggestionId.value = s.id
    try {
      if (s.target === 'project') {
        await updateProject(pid, { [s.field]: s.value } as Partial<CreativeProject>)
      } else if (s.target === 'director') {
        const current = activeProject.value?.director || {}
        const next: ProjectDirector = {
          ...current,
          [s.field]: s.value
        }
        await updateProject(pid, { director: next })
      } else if (s.target === 'character' && s.characterId) {
        await $fetch(`/api/projects/${pid}/characters/${s.characterId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: { [s.field]: s.value }
        })
      } else {
        throw new Error('Unsupported suggestion')
      }

      const targetId = s.target === 'character' && s.characterId ? s.characterId : pid

      await logDecision({
        sourceType: 'guide_suggestion',
        sourceId: s.id,
        targetType: s.target,
        targetId,
        field: s.field,
        oldValue,
        newValue: s.value,
        rationale: s.rationale
      })

      appliedSuggestionIds.value = new Set([...appliedSuggestionIds.value, s.id])
      toast.showToast(`Applied: ${s.label}`, 'success')
    } catch (e: unknown) {
      toast.showToast(formatApiFetchError(e, 'Could not apply update'), 'error')
    } finally {
      applyingSuggestionId.value = ''
    }
  }

  function dismissSuggestion (messageId: string, suggestionId: string) {
    patchMessages((current) =>
      current.map((msg) => {
        if (msg.id !== messageId || !msg.suggestions) return msg
        return {
          ...msg,
          suggestions: msg.suggestions.filter((s) => s.id !== suggestionId)
        }
      })
    )
  }

  async function clearChat () {
    if (!globalThis.confirm('Clear this chat history? Project data will not be changed.')) return
    clearMessages()
    appliedSuggestionIds.value = new Set()
    try {
      await flushSync()
    } catch {
      /* local cleared */
    }
  }

  function bindWatchers () {
    watch(
      [canUseGuide, projectId],
      () => {
        void loadStatus()
      },
      { immediate: true }
    )

    watch(
      projectId,
      () => {
        appliedSuggestionIds.value = new Set()
      },
      { immediate: true }
    )
  }

  return {
    activeProject,
    canUseGuide,
    messages,
    guideLoading,
    draft,
    sending,
    applyingSuggestionId,
    appliedSuggestionIds,
    needsStory,
    statusBits,
    starters,
    bindWatchers,
    loadStatus,
    sendStarter,
    sendMessage,
    applySuggestion,
    dismissSuggestion,
    clearChat
  }
}
