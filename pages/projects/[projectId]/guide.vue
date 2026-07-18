<template>
  <div class="max-w-3xl flex flex-col min-h-[calc(100vh-14rem)]">
    <div
      v-if="!canUseGuide"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Sign in and open a cloud project to use the Guide.
    </div>

    <template v-else>
      <div
        v-if="statusBits.length"
        class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500"
      >
        <span
          v-for="(bit, i) in statusBits"
          :key="bit"
          class="inline-flex items-center gap-2"
        >
          <span v-if="i > 0" class="text-gray-300" aria-hidden="true">·</span>
          <span>{{ bit }}</span>
        </span>
        <NuxtLink
          v-if="needsStory"
          :to="`/projects/${projectId}/overview`"
          class="ml-1 text-primary font-medium hover:underline"
        >
          Add story →
        </NuxtLink>
      </div>

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
            class="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-sm text-gray-600"
          >
            <p class="text-base font-semibold text-gray-900 mb-1">
              {{ needsStory ? 'Start with your story' : 'Ask anything about this project' }}
            </p>
            <p class="mb-5 text-gray-500 max-w-md">
              <template v-if="needsStory">
                Import a screenplay or add a synopsis on Story — then come back here to talk it through.
              </template>
              <template v-else>
                The guide reads your story, cast, and scenes. Suggested changes only apply when you approve them.
              </template>
            </p>
            <div v-if="needsStory" class="mb-4">
              <NuxtLink
                :to="`/projects/${projectId}/overview`"
                class="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-gray-950 text-sm font-semibold hover:bg-primary/90"
              >
                Go to Story →
              </NuxtLink>
            </div>
            <ul v-else class="grid gap-2 sm:grid-cols-2">
              <li
                v-for="(starter, i) in starters"
                :key="i"
              >
                <button
                  type="button"
                  class="text-left w-full h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
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
            :placeholder="needsStory
              ? 'Add a story first — or ask a general question…'
              : 'Ask about your story, characters, continuity…'"
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
import { displayProjectSynopsis } from '~/lib/format-stored-concept'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { CreativeProject, ProjectDirector, CreativeCharacter } from '~/types/creative-project'
import type { CreativeSceneListItem } from '~/types/creative-scene'

const PB_ID = /^[a-z0-9]{15}$/

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

watch([canUseGuide, projectId], () => {
  void loadStatus()
}, { immediate: true })

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
    toast.showToast(formatApiFetchError(e, 'Could not reach Guide'), 'error')
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

useHead({ title: 'Guide' })
</script>
