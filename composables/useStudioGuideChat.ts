import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { pollScriptImportJob } from '~/lib/poll-script-import-job'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import { describeDurationClipPlan } from '~/lib/project-duration-budget'
import {
  STUDIO_GUIDE_STARTERS,
  createEmptyStudioGuideChat,
  deleteStudioGuideChat,
  emptyStudioGuideChatStore,
  loadStudioGuideChatStore,
  newStudioGuideMessageId,
  isCloudProjectId,
  saveStudioGuideChatStore,
  titleFromStudioGuideMessages,
  upsertStudioGuideChat,
  type StudioGuideAction,
  type StudioGuideBuildProject,
  type StudioGuideChat,
  type StudioGuideChatMessage,
  type StudioGuideChatStore
} from '~/lib/studio-guide'
import type { CreativeProject } from '~/types/creative-project'

/**
 * Shared Studio Guide (Home) chat — used by /guide and the floating companion.
 * Store is useState-backed so both surfaces stay in sync.
 */
export function useStudioGuideChat () {
  const { getAuthToken, isAuthenticated } = useAuth()
  const { persistGuideTurn, deleteConversation } = useConversations()
  const { projects, loadServerProjects, clientReady, registerImportedProject, withProjectQuery } =
    useCreativeProject()
  const toast = useToast()

  const store = useState<StudioGuideChatStore>('studio-guide-chat-store', () =>
    emptyStudioGuideChatStore()
  )
  const hydrated = useState('studio-guide-chat-hydrated', () => false)
  const draft = useState('studio-guide-chat-draft', () => '')
  const sending = useState('studio-guide-chat-sending', () => false)
  const building = useState('studio-guide-chat-building', () => false)

  const starters = STUDIO_GUIDE_STARTERS

  const activeChatId = computed(() => store.value.activeChatId)
  const activeChat = computed(
    () => store.value.chats.find((c) => c.id === store.value.activeChatId) || null
  )
  const messages = computed(() => activeChat.value?.messages || [])
  const sortedChats = computed(() =>
    [...store.value.chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  )

  const recentProjects = computed(() =>
    projects.value
      .filter((p) => isCloudProjectId(p.id))
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name }))
  )

  function persist () {
    saveStudioGuideChatStore(store.value)
  }

  function hydrateFromStorage () {
    if (hydrated.value) return
    if (!import.meta.client) return
    store.value = loadStudioGuideChatStore()
    if (!store.value.activeChatId) {
      const chat = createEmptyStudioGuideChat()
      store.value = upsertStudioGuideChat(store.value, chat)
      persist()
    }
    hydrated.value = true
  }

  function ensureActiveChat (): StudioGuideChat {
    let chat = activeChat.value
    if (chat) return chat
    chat = createEmptyStudioGuideChat()
    store.value = upsertStudioGuideChat(store.value, chat)
    persist()
    return chat
  }

  function patchActiveChat (updater: (chat: StudioGuideChat) => StudioGuideChat) {
    const current = ensureActiveChat()
    const next = updater(current)
    store.value = upsertStudioGuideChat(store.value, next)
    persist()
  }

  function startNewChat () {
    if (sending.value || building.value) return
    const chat = createEmptyStudioGuideChat()
    store.value = upsertStudioGuideChat(store.value, chat)
    persist()
    draft.value = ''
  }

  function selectChat (chatId: string) {
    if (sending.value || building.value) return
    if (!store.value.chats.some((c) => c.id === chatId)) return
    store.value = { ...store.value, activeChatId: chatId }
    persist()
  }

  function deleteChat (chatId: string) {
    if (sending.value || building.value) return
    if (!globalThis.confirm('Delete this chat?')) return
    const target = store.value.chats.find((c) => c.id === chatId)
    if (target?.pbConversationId && isAuthenticated.value) {
      void deleteConversation(target.pbConversationId).catch(() => {})
    }
    let next = deleteStudioGuideChat(store.value, chatId)
    if (!next.chats.length) {
      const chat = createEmptyStudioGuideChat()
      next = upsertStudioGuideChat(next, chat)
    }
    store.value = next
    persist()
  }

  function clearActiveChat () {
    if (!globalThis.confirm('Clear messages in this chat?')) return
    patchActiveChat((chat) => ({
      ...chat,
      title: 'New chat',
      messages: [],
      updatedAt: new Date().toISOString()
    }))
  }

  function appendMessage (msg: StudioGuideChatMessage) {
    patchActiveChat((chat) => {
      const nextMessages = [...chat.messages, msg]
      const title =
        chat.title === 'New chat' || !chat.title.trim()
          ? titleFromStudioGuideMessages(nextMessages)
          : chat.title
      return {
        ...chat,
        title,
        messages: nextMessages,
        updatedAt: new Date().toISOString()
      }
    })
  }

  function sendStarter (prompt: string) {
    draft.value = prompt
    void sendMessage()
  }

  async function persistTurnQuietly (opts: {
    role: 'user' | 'assistant'
    content: string
    model?: string
    titleSource: string
  }) {
    if (!isAuthenticated.value) return
    try {
      const chat = ensureActiveChat()
      const pbId = await persistGuideTurn({
        conversationId: chat.pbConversationId,
        titleSource: opts.titleSource,
        role: opts.role,
        content: opts.content,
        model: opts.model
      })
      if (pbId && pbId !== chat.pbConversationId) {
        patchActiveChat((c) => ({ ...c, pbConversationId: pbId }))
      }
    } catch (e) {
      console.warn('Could not save conversation history', e)
    }
  }

  async function sendMessage () {
    const text = draft.value.trim()
    if (!text || sending.value || building.value) return

    const token = getAuthToken()
    ensureActiveChat()
    appendMessage({
      id: newStudioGuideMessageId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    })
    draft.value = ''
    sending.value = true

    await persistTurnQuietly({ role: 'user', content: text, titleSource: text })

    try {
      const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await $fetch<{
        reply: string
        actions: StudioGuideAction[]
        buildProject?: StudioGuideBuildProject
        model?: string
      }>('/api/guide', {
        method: 'POST',
        headers,
        body: { messages: history }
      })
      const reply = res.reply || 'Here’s where I’d start.'
      appendMessage({
        id: newStudioGuideMessageId(),
        role: 'assistant',
        content: reply,
        actions: res.actions || [],
        buildProject: res.buildProject,
        createdAt: new Date().toISOString(),
        ...(res.model ? { model: res.model } : {})
      })
      await persistTurnQuietly({
        role: 'assistant',
        content: reply,
        model: res.model,
        titleSource: text
      })
    } catch (e: unknown) {
      toast.showToast(formatApiFetchError(e, 'Could not reach Guide'), 'error')
      appendMessage({
        id: newStudioGuideMessageId(),
        role: 'assistant',
        content: 'Sorry — I could not respond right now. Check your connection and try again.',
        createdAt: new Date().toISOString()
      })
    } finally {
      sending.value = false
    }
  }

  async function buildFromBrief (build: StudioGuideBuildProject) {
    if (building.value || sending.value) return
    if (!isAuthenticated.value) {
      await navigateTo({ path: '/login', query: { redirect: '/guide' } })
      return
    }
    const token = getAuthToken()
    if (!token) {
      await navigateTo({ path: '/login', query: { redirect: '/guide' } })
      return
    }

    building.value = true
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const started = await $fetch<{
        async: boolean
        jobId: string
        project: CreativeProject
      }>('/api/guide/build-project', {
        method: 'POST',
        headers,
        body: { brief: build.brief }
      })

      if (!started.jobId || !started.project?.id) {
        throw new Error('Server did not start the build')
      }

      registerImportedProject(started.project)
      appendMessage({
        id: newStudioGuideMessageId(),
        role: 'assistant',
        content: `Creating “${started.project.name || build.brief.title}” and generating the first draft materials. This can take a few minutes…`,
        createdAt: new Date().toISOString()
      })

      const polled = await pollScriptImportJob(started.jobId, headers, {
        maxMs: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
      })
      registerImportedProject(polled.project)
      const secs = build.brief.targetDurationSeconds
      const clipPlan =
        typeof secs === 'number' && secs >= 5 ? describeDurationClipPlan(secs) : 'your storyboard clips'
      const singleClip = typeof secs === 'number' && secs <= 10
      toast.showToast(
        singleClip
          ? 'Project built — add cast looks, then generate the one clip on Storyboard.'
          : 'Project built — review cast, then storyboard frames and Generate video.',
        'success'
      )
      appendMessage({
        id: newStudioGuideMessageId(),
        role: 'assistant',
        content: singleClip
          ? `Done — this is ${clipPlan}. Next: quick cast check, then Storyboard (start + end frames) and Generate video on that one board.`
          : `Done — planned for ${clipPlan}. Review cast, then on Storyboard fill start/end frames and Generate video per board.`,
        actions: [
          {
            id: newStudioGuideMessageId(),
            label: 'Open Characters',
            path: `/projects/${polled.projectId}/characters`,
            rationale: 'Review and refine the cast.'
          },
          {
            id: newStudioGuideMessageId(),
            label: 'Open Storyboard',
            path: `/projects/${polled.projectId}/storyboard`,
            rationale: singleClip
              ? 'One board → start/end frames → Generate video.'
              : 'Fill frames and generate clips.'
          }
        ],
        createdAt: new Date().toISOString()
      })
      await navigateTo(
        withProjectQuery(
          singleClip
            ? `/projects/${polled.projectId}/storyboard`
            : `/projects/${polled.projectId}/characters`
        )
      )
    } catch (e: unknown) {
      toast.showToast(
        formatApiFetchError(e, 'Could not build the project. Try again or continue from Projects.'),
        'error'
      )
      appendMessage({
        id: newStudioGuideMessageId(),
        role: 'assistant',
        content:
          'I couldn’t finish building that project. You can try Build again, or open Projects and continue from there.',
        actions: [
          {
            id: newStudioGuideMessageId(),
            label: 'Open Projects',
            path: '/projects',
            rationale: 'See your projects list.'
          }
        ],
        createdAt: new Date().toISOString()
      })
    } finally {
      building.value = false
    }
  }

  const projectsWatchAttached = useState('studio-guide-projects-watch', () => false)

  function ensureProjectsLoaded () {
    if (projectsWatchAttached.value) return
    projectsWatchAttached.value = true
    watch(
      clientReady,
      (ready) => {
        if (ready && isAuthenticated.value) {
          void loadServerProjects()
        }
      },
      { immediate: true }
    )
  }

  return {
    store,
    hydrated,
    draft,
    sending,
    building,
    starters,
    activeChatId,
    activeChat,
    messages,
    sortedChats,
    recentProjects,
    isAuthenticated,
    hydrateFromStorage,
    ensureProjectsLoaded,
    startNewChat,
    selectChat,
    deleteChat,
    clearActiveChat,
    sendStarter,
    sendMessage,
    buildFromBrief
  }
}
