<template>
  <div class="max-w-3xl mx-auto flex flex-col min-h-[calc(100vh-10rem)] px-4 sm:px-0 py-6 sm:py-10">
    <div
      v-if="!isAuthenticated"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <NuxtLink to="/login?redirect=/guide" class="font-semibold text-primary hover:underline">
        Sign in
      </NuxtLink>
      to use the Studio Guide.
    </div>

    <div
      v-else
      class="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden min-h-[28rem]"
    >
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
            Tell me a goal — start a project, import a script, generate video, or continue something you’ve already begun — and I’ll route you there.
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
                :disabled="sending"
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
          placeholder="What do you want to do today?"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary resize-y min-h-[4.5rem]"
          :disabled="sending"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            class="text-xs text-gray-500 hover:text-red-700 disabled:opacity-40"
            :disabled="sending || !messages.length"
            @click="clearChat"
          >
            Clear chat
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90 disabled:opacity-50"
            :disabled="sending || !draft.trim()"
          >
            {{ sending ? 'Sending…' : 'Send' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  STUDIO_GUIDE_STARTERS,
  loadStudioGuideMessages,
  saveStudioGuideMessages,
  newStudioGuideMessageId,
  projectGuidePath,
  isCloudProjectId,
  type StudioGuideAction,
  type StudioGuideChatMessage
} from '~/lib/studio-guide'

const { getAuthToken, isAuthenticated } = useAuth()
const { projects, loadServerProjects, clientReady } = useCreativeProject()
const toast = useToast()

const messages = ref<StudioGuideChatMessage[]>([])
const draft = ref('')
const sending = ref(false)
const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const starters = STUDIO_GUIDE_STARTERS

const recentProjects = computed(() =>
  projects.value
    .filter(p => isCloudProjectId(p.id))
    .slice(0, 4)
    .map(p => ({ id: p.id, name: p.name }))
)

onMounted(() => {
  messages.value = loadStudioGuideMessages()
})

watch(clientReady, (ready) => {
  if (ready && isAuthenticated.value) {
    void loadServerProjects()
  }
}, { immediate: true })

watch(messages, (list) => {
  saveStudioGuideMessages(list)
  nextTick(() => {
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  })
}, { deep: true })

function appendMessage (msg: StudioGuideChatMessage) {
  messages.value = [...messages.value, msg]
}

function sendStarter (prompt: string) {
  draft.value = prompt
  void sendMessage()
}

async function sendMessage () {
  const text = draft.value.trim()
  if (!text || sending.value || !isAuthenticated.value) return

  const token = getAuthToken()
  if (!token) return

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
    const res = await $fetch<{ reply: string; actions: StudioGuideAction[] }>(
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

function clearChat () {
  if (!globalThis.confirm('Clear this chat history?')) return
  messages.value = []
  saveStudioGuideMessages([])
}

useHead({ title: 'Guide' })
</script>
