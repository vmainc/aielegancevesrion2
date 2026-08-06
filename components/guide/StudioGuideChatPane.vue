<script setup lang="ts">
import { describeDurationClipPlan } from '~/lib/project-duration-budget'
import {
  formatStudioGuideChatTime,
  projectGuidePath,
  type StudioGuideBuildProject
} from '~/lib/studio-guide'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    showHistory?: boolean
  }>(),
  { compact: false, showHistory: true }
)

const {
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
} = useStudioGuideChat()

const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const mobileHistoryOpen = ref(false)

onMounted(() => {
  hydrateFromStorage()
  ensureProjectsLoaded()
})

watch(
  messages,
  () => {
    nextTick(() => {
      scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
    })
  },
  { deep: true }
)

function onStartNewChat () {
  startNewChat()
  mobileHistoryOpen.value = false
  nextTick(() => inputEl.value?.focus())
}

function onSelectChat (id: string) {
  selectChat(id)
  mobileHistoryOpen.value = false
  nextTick(() => inputEl.value?.focus())
}

async function onBuild (build: StudioGuideBuildProject) {
  await buildFromBrief(build)
  nextTick(() => inputEl.value?.focus())
}

async function onSend () {
  await sendMessage()
  nextTick(() => inputEl.value?.focus())
}
</script>

<template>
  <div
    v-if="!isAuthenticated"
    class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
  >
    <NuxtLink to="/login?redirect=/guide" class="font-semibold text-primary hover:underline">
      Sign in
    </NuxtLink>
    to use Home — your Studio Guide.
  </div>

  <div
    v-else
    class="flex flex-col min-h-0 h-full overflow-hidden"
    :class="compact ? '' : 'sm:rounded-xl sm:border sm:border-gray-200 sm:bg-white sm:shadow-sm'"
  >
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <aside
        v-if="showHistory && !compact"
        class="hidden sm:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50"
        aria-label="Chat history"
      >
        <div class="p-3 border-b border-gray-200">
          <button
            type="button"
            class="w-full rounded-lg bg-primary text-gray-950 text-sm font-semibold px-3 py-2.5 hover:bg-primary/90 transition-colors"
            @click="onStartNewChat"
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
            @click="onSelectChat(chat.id)"
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

      <div class="flex-1 flex flex-col min-w-0 bg-white min-h-0">
        <div
          v-if="showHistory && !compact"
          class="sm:hidden flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 bg-gray-50"
        >
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
            @click="onStartNewChat"
          >
            New
          </button>
        </div>

        <div
          v-if="showHistory && !compact && mobileHistoryOpen"
          class="sm:hidden border-b border-gray-200 bg-gray-50 max-h-56 overflow-y-auto px-2 py-2 space-y-0.5"
        >
          <button
            v-for="chat in sortedChats"
            :key="`m-${chat.id}`"
            type="button"
            class="w-full text-left rounded-lg px-2.5 py-2 text-sm"
            :class="chat.id === activeChatId ? 'bg-white border border-gray-200' : 'hover:bg-white/80'"
            @click="onSelectChat(chat.id)"
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
          class="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/60 min-h-0"
        >
          <div
            v-if="!messages.length"
            class="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-sm text-gray-600"
            :class="compact ? 'py-6' : 'py-10'"
          >
            <p
              class="font-semibold text-gray-900 mb-2 tracking-tight"
              :class="compact ? 'text-base' : 'text-xl sm:text-2xl'"
            >
              What do you want to do today?
            </p>
            <p class="mb-6 text-gray-500 max-w-md" :class="compact ? 'text-xs mb-4' : ''">
              Tell me how long the finished video should be (clips are 5s or 10s) and what you want to make — I’ll size the project to that runtime, then build it.
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

            <ul class="grid gap-2" :class="compact ? 'grid-cols-1' : 'sm:grid-cols-2'">
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
                  @click="onBuild(msg.buildProject)"
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
          class="border-t border-gray-200 bg-white p-3 flex flex-col gap-2 shrink-0"
          @submit.prevent="onSend"
        >
          <textarea
            ref="inputEl"
            v-model="draft"
            :rows="compact ? 2 : 3"
            maxlength="4000"
            placeholder="Message Home…"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary resize-y"
            :class="compact ? 'min-h-[3.5rem]' : 'min-h-[4.5rem]'"
            :disabled="sending || building"
            @keydown.enter.exact.prevent="onSend"
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
