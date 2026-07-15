<template>
  <div class="max-w-3xl flex flex-col min-h-[calc(100vh-14rem)]">
    <div class="mb-4">
      <p class="text-sm text-gray-500">
        <span class="text-primary font-medium">Project Guide</span>
        · Chat about your film. The guide reads your story, cast, and scenes — and can suggest updates you approve before anything changes.
      </p>
    </div>

    <div
      v-if="!canUseGuide"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Sign in and open a cloud project to use the Project Guide.
    </div>

    <template v-else>
      <div class="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden min-h-[28rem]">
        <div
          ref="scrollEl"
          class="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/60"
        >
          <div
            v-if="guideLoading && !messages.length"
            class="rounded-lg border border-gray-200 bg-white px-4 py-6"
          >
            <FilmReelLoader size="sm" label="Loading chat" sub-label="Fetching your guide history…" />
          </div>

          <div
            v-else-if="!messages.length"
            class="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-600"
          >
            <p class="font-medium text-gray-900 mb-2">Start a conversation</p>
            <p class="mb-3">
              Ask about continuity, character motivation, tone, or what to refine next. When you decide something, the guide can suggest saving it to your project bible or character profiles.
            </p>
            <ul class="space-y-2 text-xs text-gray-500">
              <li
                v-for="(starter, i) in starters"
                :key="i"
              >
                <button
                  type="button"
                  class="text-left w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  :disabled="sending"
                  @click="sendStarter(starter)"
                >
                  {{ starter }}
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
                v-if="msg.role === 'assistant' && msg.suggestions?.length"
                class="mt-3 space-y-2 border-t border-gray-100 pt-3"
              >
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Suggested updates
                </p>
                <div
                  v-for="s in msg.suggestions"
                  :key="s.id"
                  class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs"
                  :class="appliedSuggestionIds.has(s.id) ? 'opacity-60' : ''"
                >
                  <p class="font-semibold text-gray-900 mb-0.5">{{ s.label }}</p>
                  <p v-if="s.rationale" class="text-gray-500 mb-2">{{ s.rationale }}</p>
                  <pre class="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-28 overflow-y-auto mb-2">{{ s.value }}</pre>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md bg-primary text-gray-950 font-semibold hover:bg-primary/90 disabled:opacity-50"
                      :disabled="applyingSuggestionId === s.id || appliedSuggestionIds.has(s.id)"
                      @click="applySuggestion(s)"
                    >
                      {{ appliedSuggestionIds.has(s.id) ? 'Applied' : applyingSuggestionId === s.id ? 'Applying…' : 'Apply' }}
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
                      :disabled="appliedSuggestionIds.has(s.id)"
                      @click="dismissSuggestion(msg.id, s.id)"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="sending" class="flex justify-start">
            <div class="rounded-xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <FilmReelLoader size="sm" label="Thinking" sub-label="Reading your project context…" />
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
            placeholder="Ask about your story, characters, continuity…"
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { newGuideMessageId, type GuideChatMessage, type GuideSuggestion } from '~/lib/project-guide'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { CreativeProject, ProjectDirector } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

const route = useRoute()
const { activeProject, activeProjectId, updateProject } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const canUseGuide = computed(
  () => !!activeProject.value && PB_ID.test(projectId.value) && isAuthenticated.value
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
const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const starters = [
  'What continuity gaps do you see in this project?',
  'Claude should feel more haunted — help me refine his character profile.',
  'Summarize the tone and visual style we should keep consistent.',
  'What should I focus on before generating storyboard frames?'
]

watch(projectId, () => {
  appliedSuggestionIds.value = new Set()
}, { immediate: true })

watch(messages, () => {
  nextTick(() => {
    scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  })
}, { deep: true })

function sendStarter (text: string) {
  draft.value = text
  void sendMessage()
}

function readFieldValue (
  target: GuideSuggestion['target'],
  field: string,
  characterId?: string
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
  if (target === 'character' && characterId) {
    return ''
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
    const history = messages.value.map(m => ({ role: m.role, content: m.content }))
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
    toast.showToast(formatApiFetchError(e, 'Could not reach Project Guide'), 'error')
    appendMessage({
      id: newGuideMessageId(),
      role: 'assistant',
      content: 'Sorry — I could not respond right now. Check your connection and try again.',
      createdAt: new Date().toISOString()
    })
  } finally {
    sending.value = false
    nextTick(() => inputEl.value?.focus())
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

    const targetId =
      s.target === 'character' && s.characterId ? s.characterId : pid

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
        suggestions: msg.suggestions.filter(s => s.id !== suggestionId)
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

useHead({ title: 'Project Guide' })
</script>
