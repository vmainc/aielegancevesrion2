<script setup lang="ts">
import {
  isGuideCompanionVisible,
  resolveGuideCompanionMode,
  type GuideCompanionMode
} from '~/lib/guide-companion'

const { showAuthenticatedUi } = useAuth()
const { projects } = useCreativeProject()
const route = useRoute()

const open = useState('guide-companion-open', () => false)

const mode = computed<GuideCompanionMode>(() =>
  resolveGuideCompanionMode(route.path)
)

const visible = computed(
  () => showAuthenticatedUi.value && isGuideCompanionVisible(mode.value)
)

const projectName = computed(() => {
  const m = mode.value
  if (m.kind !== 'project') return ''
  const p = projects.value.find((x) => x.id === m.projectId)
  return p?.name?.trim() || 'Project'
})

const headerTitle = computed(() => {
  if (mode.value.kind === 'project') return projectName.value
  return 'Home'
})

const headerSubtitle = computed(() => {
  if (mode.value.kind === 'project') return 'Project Guide'
  return 'Studio Guide'
})

function toggle () {
  open.value = !open.value
}

function close () {
  open.value = false
}

function onKeydown (e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    close()
  }
}

watch(visible, (v) => {
  if (!v) open.value = false
})

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-0 z-[45]"
      aria-live="polite"
    >
      <!-- Backdrop when open -->
      <button
        v-if="open"
        type="button"
        class="pointer-events-auto absolute inset-0 bg-gray-950/25 border-0 cursor-default"
        aria-label="Close Guide"
        @click="close"
      />

      <!-- Panel -->
      <div
        v-if="open"
        class="pointer-events-auto absolute bottom-0 right-0 sm:bottom-6 sm:right-6 flex flex-col w-full sm:w-[min(420px,calc(100vw-1.5rem))] h-[min(85vh,40rem)] sm:h-[min(70vh,36rem)] sm:rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Guide companion"
      >
        <header class="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 shrink-0">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 truncate">
              {{ headerTitle }}
            </p>
            <p class="text-[11px] text-gray-500 truncate">
              {{ headerSubtitle }}
            </p>
          </div>
          <NuxtLink
            v-if="mode.kind === 'studio'"
            to="/guide"
            class="shrink-0 text-xs font-medium text-primary hover:underline"
            @click="close"
          >
            Open Home
          </NuxtLink>
          <NuxtLink
            v-else-if="mode.kind === 'project'"
            :to="`/projects/${mode.projectId}/guide`"
            class="shrink-0 text-xs font-medium text-primary hover:underline"
            @click="close"
          >
            Full Guide
          </NuxtLink>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            @click="close"
          >
            Close
          </button>
        </header>

        <div class="flex-1 min-h-0 flex flex-col">
          <StudioGuideChatPane
            v-if="mode.kind === 'studio'"
            compact
            :show-history="false"
            class="h-full"
          />
          <ProjectGuideChatPane
            v-else-if="mode.kind === 'project'"
            :project-id="mode.projectId"
            compact
            :show-status="true"
            class="h-full px-2 pt-2"
          />
        </div>
      </div>

      <!-- FAB -->
      <button
        v-show="!open"
        type="button"
        class="pointer-events-auto absolute bottom-5 right-5 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 rounded-full bg-primary text-gray-950 pl-3.5 pr-4 py-3 text-sm font-semibold shadow-lg hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Open Guide"
        @click="toggle"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        Guide
      </button>
    </div>
  </Teleport>
</template>
