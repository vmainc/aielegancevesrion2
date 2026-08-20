<script setup lang="ts">
const props = defineProps<{
  projectId: string
  compact?: boolean
  showStatus?: boolean
}>()

const projectIdRef = toRef(props, 'projectId')

const {
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
  sendStarter,
  sendMessage,
  applySuggestion,
  dismissSuggestion,
  clearChat
} = useProjectGuideChat(projectIdRef)

const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)

bindWatchers()

watch(
  messages,
  () => {
    nextTick(() => {
      scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
    })
  },
  { deep: true }
)

async function onSend () {
  await sendMessage()
  nextTick(() => inputEl.value?.focus())
}
</script>

<template>
  <div class="flex flex-col min-h-0 h-full">
    <div
      v-if="!canUseGuide"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Sign in and open a cloud project to use the Guide.
    </div>

    <template v-else>
      <div
        v-if="showStatus !== false && statusBits.length"
        class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 shrink-0"
        :class="compact ? 'px-1' : ''"
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

      <div
        class="flex-1 flex flex-col min-h-0 overflow-hidden bg-studio-slate"
        :class="compact ? '' : 'rounded-xl border border-gray-200 shadow-sm'"
      >
        <div
          ref="scrollEl"
          class="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/60 min-h-0"
        >
          <div
            v-if="guideLoading && !messages.length"
            class="rounded-lg border border-gray-200 bg-studio-slate px-4 py-6"
          >
            <FilmReelLoader size="sm" label="Loading chat" sub-label="Fetching your guide history…" />
          </div>

          <div
            v-else-if="!messages.length"
            class="rounded-lg border border-dashed border-gray-300 bg-studio-slate px-4 py-8 text-sm text-gray-600"
          >
            <p class="text-base font-semibold text-gray-900 mb-1">
              {{ needsStory ? 'Start with your story' : 'Ask anything about this project' }}
            </p>
            <p class="mb-5 text-gray-500 max-w-md" :class="compact ? 'text-xs' : ''">
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
            <ul
              v-else
              class="grid gap-2"
              :class="compact ? 'grid-cols-1' : 'sm:grid-cols-2'"
            >
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
                : 'bg-studio-slate border border-gray-200 text-gray-800'"
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
                      class="px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-studio-slate disabled:opacity-50"
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
            <div class="rounded-xl px-4 py-3 bg-studio-slate border border-gray-200 shadow-sm">
              <FilmReelLoader size="sm" label="Thinking" sub-label="Reading your project context…" />
            </div>
          </div>
        </div>

        <form
          class="border-t border-gray-200 bg-studio-slate p-3 flex flex-col gap-2 shrink-0"
          @submit.prevent="onSend"
        >
          <textarea
            ref="inputEl"
            v-model="draft"
            :rows="compact ? 2 : 3"
            maxlength="4000"
            :placeholder="needsStory
              ? 'Add a story first — or ask a general question…'
              : 'Ask about your story, characters, continuity…'"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary resize-y"
            :class="compact ? 'min-h-[3.5rem]' : 'min-h-[4.5rem]'"
            :disabled="sending"
            @keydown.enter.exact.prevent="onSend"
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
