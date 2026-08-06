<template>
  <div class="max-w-6xl mx-auto px-0 sm:px-4 py-0 sm:py-6">
    <div
      v-if="!isAuthenticated"
      class="mx-4 sm:mx-0 mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <NuxtLink to="/login?redirect=/guide" class="font-semibold text-primary hover:underline">
        Sign in
      </NuxtLink>
      to use Home — your Studio Guide.
    </div>

    <div
      v-else
      class="flex min-h-[calc(100vh-8rem)] sm:min-h-[calc(100vh-10rem)] sm:rounded-xl sm:border sm:border-gray-200 sm:bg-white sm:shadow-sm overflow-hidden"
    >
      <!-- Desktop sidebar -->
      <aside
        class="hidden sm:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50"
        aria-label="Chat history"
      >
        <div class="p-3 border-b border-gray-200">
          <button
            type="button"
            class="w-full rounded-lg bg-primary text-gray-950 text-sm font-semibold px-3 py-2.5 hover:bg-primary/90 transition-colors"
            @click="startNewChat"
          >
            New chat
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <p
            v-if="!sortedChats.length"
            class="px-2 py-3 text-xs text-gray-500"
          >
            Your conversations will show up here.
          </p>
          <button
            v-for="chat in sortedChats"
            :key="chat.id"
            type="button"
            class="group w-full text-left rounded-lg px-2.5 py-2 transition-colors"
            :class="chat.id === activeChatId
              ? 'bg-white border border-gray-200 shadow-sm'
              : 'hover:bg-white/80 border border-transparent'"
            @click="selectChat(chat.id)"
          >
            <div class="flex items-start justify-between gap-1">
              <span class="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                {{ chat.title || 'New chat' }}
              </span>
              <button
                type="button"
                class="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-0.5 rounded"
                title="Delete chat"
                aria-label="Delete chat"
                @click.stop="deleteChat(chat.id)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <span class="mt-1 block text-[11px] text-gray-500">
              {{ formatStudioGuideChatTime(chat.updatedAt) }}
            </span>
          </button>
        </div>
      </aside>

      <!-- Main column -->
      <div class="flex-1 flex flex-col min-w-0 bg-white">
        <!-- Mobile top bar -->
        <div class="sm:hidden flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 bg-gray-50">
          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800"
            @click="mobileHistoryOpen = !mobileHistoryOpen"
          >
            {{ mobileHistoryOpen ? 'Close' : 'Chats' }}
          </button>
          <p class="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate">
            {{ activeChat?.title || 'Home' }}
          </p>
          <button
            type="button"
            class="rounded-lg bg-primary text-gray-950 px-2.5 py-1.5 text-xs font-semibold"
            @click="startNewChat"
          >
            New
          </button>
        </div>

        <!-- Mobile history drawer -->
        <div
          v-if="mobileHistoryOpen"
          class="sm:hidden border-b border-gray-200 bg-gray-50 max-h-56 overflow-y-auto px-2 py-2 space-y-0.5"
        >
          <button
            v-for="chat in sortedChats"
            :key="`m-${chat.id}`"
            type="button"
            class="w-full text-left rounded-lg px-2.5 py-2 text-sm"
            :class="chat.id === activeChatId ? 'bg-white border border-gray-200' : 'hover:bg-white/80'"
            @click="selectChat(chat.id); mobileHistoryOpen = false"
          >
            <span class="font-medium text-gray-900 line-clamp-1">{{ chat.title || 'New chat' }}</span>
            <span class="block text-[11px] text-gray-500 mt-0.5">
              {{ formatStudioGuideChatTime(chat.updatedAt) }}
            </span>
          </button>
          <p v-if="!sortedChats.length" class="px-2 py-2 text-xs text-gray-500">No chats yet.</p>
        </div>

        <div
          ref="scrollEl"
          class="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/60"
        >
          <div
            v-if="!messages.length"
            class="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-sm text-gray-600"
          >
            <p class="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 tracking-tight">
              What do you want to do today?
            </p>
            <p class="mb-6 text-gray-500 max-w-md">
              Tell me how long the finished video should be (clips are 5s or 10s) and what you want to make — I’ll size the project to that runtime, then build it. A ~10s ask becomes one board and one Generate video.
            </p>

            <div
              v-if="recentProjects.length"
              class="mb-6"
            >
              <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Continue a project
              </p>
              <ul class="flex flex-wrap gap-2">
                <li
                  v-for="p in recentProjects"
                  :key="p.id"
                >
                  <NuxtLink
                    :to="projectGuidePath(p.id)"
                    class="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {{ p.name || 'Untitled' }}
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <ul class="grid gap-2 sm:grid-cols-2">
              <li
                v-for="(starter, i) in starters"
                :key="i"
              >
                <button
                  type="button"
                  class="text-left w-full h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  :disabled="sending || building"
                  @click="sendStarter(starter.prompt)"
                >
                  {{ starter.label }}
                </button>
              </li>
            </ul>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm"
              :class="msg.role === 'user'
                ? 'bg-primary text-gray-950'
                : 'bg-white border border-gray-200 text-gray-800'"
            >
              <p class="whitespace-pre-wrap">{{ msg.content }}</p>

              <div
                v-if="msg.role === 'assistant' && msg.buildProject"
                class="mt-3 space-y-3 border-t border-gray-100 pt-3"
              >
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Project brief
                </p>
                <dl class="grid gap-2 text-xs text-gray-700">
                  <div>
                    <dt class="font-semibold text-gray-900">{{ msg.buildProject.brief.title }}</dt>
                    <dd class="mt-0.5 text-gray-600">{{ msg.buildProject.brief.logline || msg.buildProject.brief.summary }}</dd>
                  </div>
                  <div class="flex flex-wrap gap-x-3 gap-y-1 text-gray-500">
                    <span v-if="msg.buildProject.brief.genre">{{ msg.buildProject.brief.genre }}</span>
                    <span v-if="msg.buildProject.brief.tone">{{ msg.buildProject.brief.tone }}</span>
                    <span>{{ msg.buildProject.brief.aspectRatio }}</span>
                    <span>{{ msg.buildProject.brief.goal }}</span>
                    <span v-if="msg.buildProject.brief.targetDurationSeconds">
                      ~{{ msg.buildProject.brief.targetDurationSeconds }}s
                      · {{ describeDurationClipPlan(msg.buildProject.brief.targetDurationSeconds) }}
                    </span>
                  </div>
                  <p
                    v-if="msg.buildProject.brief.characters.length"
                    class="text-gray-600"
                  >
                    Cast: {{ msg.buildProject.brief.characters.join(', ') }}
                  </p>
                </dl>
                <button
                  type="button"
                  class="w-full rounded-lg bg-primary text-gray-950 text-sm font-semibold px-3 py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
                  :disabled="sending || building"
                  @click="buildFromBrief(msg.buildProject)"
                >
                  {{ building ? 'Building…' : msg.buildProject.confirmLabel }}
                </button>
              </div>

              <div
                v-if="msg.role === 'assistant' && msg.actions?.length"
                class="mt-3 space-y-2 border-t border-gray-100 pt-3"
              >
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Next steps
                </p>
                <div class="flex flex-col gap-2">
                  <NuxtLink
                    v-for="a in msg.actions"
                    :key="a.id"
                    :to="a.path"
                    class="block rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <span class="font-semibold text-gray-900">{{ a.label }}</span>
                    <span
                      v-if="a.rationale"
                      class="block text-xs text-gray-500 mt-0.5"
                    >{{ a.rationale }}</span>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <div v-if="sending" class="flex justify-start">
            <div class="rounded-xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <FilmReelLoader size="sm" label="Thinking" sub-label="Finding the best next step…" />
            </div>
          </div>

          <div v-if="building" class="flex justify-start">
            <div class="rounded-xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <FilmReelLoader
                size="sm"
                label="Building your project"
                sub-label="Creating screenplay, cast, scenes, and storyboard…"
              />
            </div>
          </div>
        </div>

        <form
          class="border-t border-gray-200 bg-white p-3 flex flex-col gap-2"
          @submit.prevent="sendMessage"
        >
          <textarea
            ref="inputEl"
            v-model="draft"
            rows="3"
            maxlength="4000"
            placeholder="Message Home…"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary resize-y min-h-[4.5rem]"
            :disabled="sending || building"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              class="text-xs text-gray-500 hover:text-red-700 disabled:opacity-40"
              :disabled="sending || building || !messages.length"
              @click="clearActiveChat"
            >
              Clear this chat
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90 disabled:opacity-50"
              :disabled="sending || building || !draft.trim()"
            >
              {{ sending ? 'Sending…' : 'Send' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { pollScriptImportJob } from '~/lib/poll-script-import-job'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import {
  STUDIO_GUIDE_STARTERS,
  createEmptyStudioGuideChat,
  deleteStudioGuideChat,
  emptyStudioGuideChatStore,
  formatStudioGuideChatTime,
  loadStudioGuideChatStore,
  newStudioGuideMessageId,
  projectGuidePath,
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
import { describeDurationClipPlan } from '~/lib/project-duration-budget'
import type { CreativeProject } from '~/types/creative-project'

const { getAuthToken, isAuthenticated } = useAuth()
const { projects, loadServerProjects, clientReady, registerImportedProject, withProjectQuery } =
  useCreativeProject()
const toast = useToast()

const store = ref<StudioGuideChatStore>(emptyStudioGuideChatStore())
const draft = ref('')
const sending = ref(false)
const building = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const mobileHistoryOpen = ref(false)

const starters = STUDIO_GUIDE_STARTERS

const activeChatId = computed(() => store.value.activeChatId)
const activeChat = computed(() =>
  store.value.chats.find(c => c.id === store.value.activeChatId) || null
)
const messages = computed(() => activeChat.value?.messages || [])
const sortedChats = computed(() =>
  [...store.value.chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
)

const recentProjects = computed(() =>
  projects.value
    .filter(p => isCloudProjectId(p.id))
    .slice(0, 4)
    .map(p => ({ id: p.id, name: p.name }))
)

function persist () {
  saveStudioGuideChatStore(store.value)
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

onMounted(() => {
  store.value = loadStudioGuideChatStore()
  if (!store.value.activeChatId) {
    const chat = createEmptyStudioGuideChat()
    store.value = upsertStudioGuideChat(store.value, chat)
    persist()
  }
})

watch(clientReady, (ready) => {
  if (ready && isAuthenticated.value) {
    void loadServerProjects()
  }
}, { immediate: true })

watch(messages, () => {
  nextTick(() => {
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  })
}, { deep: true })

function startNewChat () {
  if (sending.value || building.value) return
  const chat = createEmptyStudioGuideChat()
  store.value = upsertStudioGuideChat(store.value, chat)
  persist()
  mobileHistoryOpen.value = false
  draft.value = ''
  nextTick(() => inputEl.value?.focus())
}

function selectChat (chatId: string) {
  if (sending.value || building.value) return
  if (!store.value.chats.some(c => c.id === chatId)) return
  store.value = { ...store.value, activeChatId: chatId }
  persist()
  nextTick(() => inputEl.value?.focus())
}

function deleteChat (chatId: string) {
  if (sending.value || building.value) return
  if (!globalThis.confirm('Delete this chat?')) return
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
  patchActiveChat(chat => ({
    ...chat,
    title: 'New chat',
    messages: [],
    updatedAt: new Date().toISOString()
  }))
}

function appendMessage (msg: StudioGuideChatMessage) {
  patchActiveChat((chat) => {
    const messages = [...chat.messages, msg]
    const title =
      chat.title === 'New chat' || !chat.title.trim()
        ? titleFromStudioGuideMessages(messages)
        : chat.title
    return {
      ...chat,
      title,
      messages,
      updatedAt: new Date().toISOString()
    }
  })
}

function sendStarter (prompt: string) {
  draft.value = prompt
  void sendMessage()
}

async function sendMessage () {
  const text = draft.value.trim()
  if (!text || sending.value || building.value || !isAuthenticated.value) return

  const token = getAuthToken()
  if (!token) return

  ensureActiveChat()
  appendMessage({
    id: newStudioGuideMessageId(),
    role: 'user',
    content: text,
    createdAt: new Date().toISOString()
  })
  draft.value = ''
  sending.value = true

  try {
    const history = messages.value.map(m => ({ role: m.role, content: m.content }))
    const res = await $fetch<{
      reply: string
      actions: StudioGuideAction[]
      buildProject?: StudioGuideBuildProject
    }>(
      '/api/guide',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { messages: history }
      }
    )
    appendMessage({
      id: newStudioGuideMessageId(),
      role: 'assistant',
      content: res.reply || 'Here’s where I’d start.',
      actions: res.actions || [],
      buildProject: res.buildProject,
      createdAt: new Date().toISOString()
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
    nextTick(() => inputEl.value?.focus())
  }
}

async function buildFromBrief (build: StudioGuideBuildProject) {
  if (building.value || sending.value || !isAuthenticated.value) return
  const token = getAuthToken()
  if (!token) return

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
    nextTick(() => inputEl.value?.focus())
  }
}

useHead({ title: 'Home' })
</script>
